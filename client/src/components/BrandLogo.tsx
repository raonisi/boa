import { cn } from "@/lib/utils";
import boaLogoMark from "@/assets/brand/boa-logo-mark.png";
import boaLogo from "@/assets/brand/boa-logo.png";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  mark?: boolean;
};

export function BrandLogo({ className, imageClassName, mark = false }: BrandLogoProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <img
        src={mark ? boaLogoMark : boaLogo}
        alt="BOA Best of All"
        className={cn("h-full w-full object-contain", imageClassName)}
        draggable={false}
      />
    </div>
  );
}
