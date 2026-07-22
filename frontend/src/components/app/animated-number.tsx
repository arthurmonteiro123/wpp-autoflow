import { useCountUp } from "@/hooks/use-count-up";

/** Número que anima de 0 até o valor com ease-out. Usa formatação pt-BR por padrão. */
export function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const animated = useCountUp(value);
  return <>{format ? format(animated) : Math.round(animated).toLocaleString("pt-BR")}</>;
}
