"""One OpenAI-compatible model. It proposes pages and judges addresses. It does not get the last word."""

from __future__ import annotations

import json
import os
from typing import TypeVar

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, ValidationError

from media_lists.prompts import BRIEF_SYSTEM, HUNTER_JUDGE_SYSTEM, JUDGE_SYSTEM, PLAN_SYSTEM
from media_lists.schema import Brief, JudgeResult, Plan

T = TypeVar("T", bound=BaseModel)

PROVIDERS = (
    ("XAI_API_KEY", "https://api.x.ai/v1", "grok-4"),
    ("OPENAI_API_KEY", "https://api.openai.com/v1", "gpt-4.1-mini"),
    ("DEEPSEEK_API_KEY", "https://api.deepseek.com/v1", "deepseek-chat"),
)


class ModelConfig:
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    @classmethod
    def from_env(cls, model: str | None = None, base_url: str | None = None) -> ModelConfig:
        load_dotenv()
        chosen_key = os.getenv("MEDIA_LIST_API_KEY")
        chosen_url = base_url or os.getenv("MEDIA_LIST_BASE_URL")
        chosen_model = model or os.getenv("MEDIA_LIST_MODEL")
        if not chosen_key:
            for env_name, default_url, default_model in PROVIDERS:
                if os.getenv(env_name):
                    chosen_key = os.environ[env_name]
                    chosen_url = chosen_url or default_url
                    chosen_model = chosen_model or default_model
                    break
        if not chosen_key:
            names = ", ".join(["MEDIA_LIST_API_KEY", *(name for name, _, _ in PROVIDERS)])
            raise RuntimeError(f"No model key set. Set one of: {names}.")
        if not chosen_url:
            chosen_url = "https://api.openai.com/v1"
        if not chosen_model:
            chosen_model = "gpt-4.1-mini"
        return cls(chosen_key, chosen_url, chosen_model)


def _json_object(text: str) -> dict:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end < start:
        raise ValueError("model did not return a JSON object")
    return json.loads(raw[start : end + 1])


class Model:
    def __init__(self, config: ModelConfig) -> None:
        self.config = config
        self.client = OpenAI(api_key=config.api_key, base_url=config.base_url, timeout=120)

    def _complete(self, system: str, user: str, schema: type[T]) -> T:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        last_error: Exception | None = None
        for attempt in range(2):
            kwargs = {
                "model": self.config.model,
                "temperature": 0.2,
                "messages": messages,
            }
            if attempt == 0:
                kwargs["response_format"] = {"type": "json_object"}
            try:
                response = self.client.chat.completions.create(**kwargs)
            except Exception as exc:
                # Some models reject response_format. The second attempt omits it.
                if attempt == 0:
                    last_error = exc
                    continue
                raise
            text = response.choices[0].message.content or ""
            try:
                return schema.model_validate(_json_object(text))
            except (ValueError, json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
                messages = [
                    *messages,
                    {"role": "assistant", "content": text[:4000]},
                    {
                        "role": "user",
                        "content": f"That was not valid JSON for the schema. Error: {exc}. Return one JSON object only.",
                    },
                ]
        raise RuntimeError(f"model returned unreadable JSON: {last_error}")

    def brief(self, newsroom_text: str) -> Brief:
        return self._complete(BRIEF_SYSTEM, newsroom_text[:28000], Brief)

    def plan(self, brief: Brief, *, target_pages: int) -> Plan:
        user = (
            f"Propose about {target_pages} pages.\n\n"
            + brief.model_dump_json()
        )
        return self._complete(PLAN_SYSTEM, user, Plan)

    def plan_more(self, brief: Brief, *, kept: int, minimum: int, already: list[str]) -> Plan:
        user = (
            f"The strict filter kept {kept} contacts. The minimum is {minimum}. "
            "Propose up to 25 more publisher pages that were not already tried. "
            "Do not invent addresses. Do not repeat a URL from the list below.\n\n"
            + brief.model_dump_json()
            + "\n\nAlready tried:\n"
            + "\n".join(already[:200])
        )
        return self._complete(PLAN_SYSTEM, user, Plan)

    def judge(self, brief: Brief, pages_payload: list[dict], *, minimum: int, maximum: int) -> JudgeResult:
        user = (
            f"Keep a contact only when the fit is real. A finished list between {minimum} and {maximum} "
            "is the aim, but a shorter list is required when the pages do not support more. "
            "Do not invent rows.\n\n"
            + brief.model_dump_json()
            + "\n\nExtracted pages:\n"
            + json.dumps(pages_payload, ensure_ascii=False)
        )
        return self._complete(JUDGE_SYSTEM, user, JudgeResult)

    def judge_hunter(self, brief: Brief, outlets_payload: list[dict]) -> JudgeResult:
        user = (
            "Choose at most one contact per outlet. Drop outlets where no candidate fits. Do not invent rows.\n\n"
            + brief.model_dump_json()
            + "\n\nOutlets and Hunter.io candidates:\n"
            + json.dumps(outlets_payload, ensure_ascii=False)
        )
        return self._complete(HUNTER_JUDGE_SYSTEM, user, JudgeResult)
