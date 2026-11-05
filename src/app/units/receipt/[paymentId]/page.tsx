import { ReceiptScreen } from "@/features/units/ReceiptScreen";

export const metadata = { title: "Receipt" };

export default function ReceiptPage({ params }: { params: { paymentId: string } }) {
  return <ReceiptScreen paymentId={params.paymentId} />;
}
