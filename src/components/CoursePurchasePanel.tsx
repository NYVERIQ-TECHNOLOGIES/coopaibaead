import { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, ShoppingCart, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StripeEmbeddedCheckout } from "./StripeEmbeddedCheckout";
import { isPaymentsConfigured } from "@/lib/stripe";

interface Props {
  courseId: string;
  title: string;
  price: number;
  promotionalPrice: number | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CoursePurchasePanel({ courseId, title, price, promotionalPrice }: Props) {
  const [open, setOpen] = useState(false);
  const finalPrice = promotionalPrice ?? price;

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Curso pago</h3>
            <p className="text-sm text-muted-foreground">
              Compre uma vez para liberar este curso ou assine o Premium para acessar todos os cursos pagos.
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              {promotionalPrice != null && promotionalPrice < price && (
                <span className="text-sm text-muted-foreground line-through">{fmtBRL(price)}</span>
              )}
              <span className="text-2xl font-heading font-bold text-foreground">{fmtBRL(finalPrice)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <Button onClick={() => setOpen(true)} disabled={!isPaymentsConfigured()} className="gap-2">
            <ShoppingCart className="w-4 h-4" /> Comprar curso
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link to="/planos"><Crown className="w-4 h-4" /> Ver Premium</Link>
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Comprar: {title}</DialogTitle>
          </DialogHeader>
          <div className="p-2 max-h-[80vh] overflow-y-auto">
            {open && <StripeEmbeddedCheckout courseId={courseId} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
