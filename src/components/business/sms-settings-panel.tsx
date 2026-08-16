// Dummy SMS settings component placeholder
export function SmsSettingsPanel({ businessId }: { businessId: string }) {
  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-card-premium">
      <h3 className="font-[Space_Grotesk] text-lg font-bold flex items-center gap-2"><div className="h-4 w-4 bg-primary/20 rounded"></div>Notifications SMS</h3>
      <p className="mt-2 text-sm text-muted-foreground">Configurez vos notifications SMS et demandez votre Sender ID pour personnaliser vos communications.</p>
      {/* Implementation: Sender ID request form + Status + Credit counter */}
    </section>
  );
}
