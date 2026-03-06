"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "./ui/button";
import { Search } from "lucide-react";

interface SearchBoxProps {
  router: ReturnType<typeof useRouter>;
}

export default function SearchBoxComponent() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(`/search?query=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="py-5 px-6 h-fit w-full">
        <Input
          type="text"
          placeholder="Search News"
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-200/50 text-stone-900 placeholder:text-stone-900 h-12 md:h-12 px-6 rounded-full text-lg ring-offset-1 ring-1 ring-stone-300/50 border-0 placeholder:font-semibold focus:ring-green-600 w-full"
          value={searchQuery}
        />
        <Button
          className="bg-transparent hover:bg-transparent text-stone-900 absolute right-6 top-6 md:top-6"
          aria-label="Search"
        >
          <Search size={20} />
        </Button>
      </form>
    </>
  );
}
