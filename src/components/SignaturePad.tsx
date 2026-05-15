import { useRef, useImperativeHandle, forwardRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(({ className }, ref) => {
  const sigRef = useRef<SignatureCanvas>(null);

  useImperativeHandle(ref, () => ({
    clear: () => sigRef.current?.clear(),
    isEmpty: () => sigRef.current?.isEmpty() ?? true,
    toDataURL: () => sigRef.current?.toDataURL("image/png") ?? "",
  }));

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="border-2 border-dashed border-border rounded-xl bg-background overflow-hidden touch-none">
        <SignatureCanvas
          ref={sigRef}
          penColor="hsl(var(--foreground))"
          canvasProps={{
            className: "w-full h-48 sm:h-56",
          }}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => sigRef.current?.clear()}>
          <Eraser className="w-4 h-4 mr-1" /> Limpar
        </Button>
      </div>
    </div>
  );
});
SignaturePad.displayName = "SignaturePad";
