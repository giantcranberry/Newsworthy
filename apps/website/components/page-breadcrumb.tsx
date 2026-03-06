import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

interface BreadcrumbProps {
  currentPage: string;
}

export default function PageBreadcrumb({ currentPage }: BreadcrumbProps) {
  return (
    <Breadcrumb className="mb-10">
      <BreadcrumbList className="text-base text-black ">
        <BreadcrumbItem>
          <BreadcrumbLink href="/">
            <Home size={20} />
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-black">{currentPage}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
