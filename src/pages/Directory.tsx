import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type CHWDirectoryEntry, type CHWLinkStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BadgeCheck, Link2, Mail, MapPin, Phone, UserPlus, Users } from "lucide-react";

export default function Directory() {
  const { isUser } = useAuth();
  const { toast } = useToast();
  const [directory, setDirectory] = useState<CHWDirectoryEntry[]>([]);
  const [linkedCHW, setLinkedCHW] = useState<CHWLinkStatus | null>(null);
  const [selectedCHW, setSelectedCHW] = useState<CHWDirectoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const registeredDirectory = useMemo(
    () =>
      directory
        .filter((entry) => entry.is_registered)
        .sort((a, b) => b.caseload_count - a.caseload_count || a.name.localeCompare(b.name)),
    [directory],
  );

  useEffect(() => {
    void loadDirectory();
  }, [isUser]);

  const loadDirectory = async () => {
    setLoading(true);
    try {
      const [directoryData, linkData] = await Promise.all([
        api.getCHWDirectory(),
        isUser ? api.getCHWLink() : Promise.resolve(null),
      ]);
      setDirectory(directoryData);
      setLinkedCHW(linkData);
    } catch (err: any) {
      toast({ title: "Unable to load CHW details", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedCHW?.id) {
      toast({
        title: "Choose a CHW",
        description: "Patients can only link a CHW from the available registered list.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.linkCHW({
        chw_name: selectedCHW.name,
        phone: selectedCHW.phone,
        region: selectedCHW.region,
        chw_user_id: selectedCHW.id,
      });
      toast({
        title: "CHW linked",
        description: `${selectedCHW.name} is now your support contact, and a follow-up appointment plus SMS notifications were created for both of you.`,
      });
      setSelectedCHW(null);
      await loadDirectory();
    } catch (err: any) {
      toast({ title: "Unable to link CHW", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isUser) {
    return (
      <div className="animate-fade-in flex flex-col gap-8">
        <header>
          <h1 className="text-4xl tracking-tight">CHW Directory</h1>
          <p className="text-muted-foreground mt-2">Registered community health workers and their current coverage.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {registeredDirectory.map((chw) => (
            <div key={chw.id} className="card-elevated p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center text-sm font-medium shrink-0">
                {chw.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{chw.name}</div>
                  <BadgeCheck className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  {chw.region}
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  {chw.phone || "No phone number on file"}
                </div>
                {chw.email && (
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    {chw.email}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-3">
                  {chw.caseload_count} patients
                  <span className="mx-2">·</span>
                  Registered account
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && registeredDirectory.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No registered CHWs found.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">CHW Support</h1>
        <p className="text-muted-foreground mt-2">Choose a registered Community Health Worker to enable SMS, realtime talk, and video call.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-6">
        <div className="card-elevated p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl">Current CHW Link</h2>
              <p className="text-sm text-muted-foreground">Your current registered CHW contact.</p>
            </div>
          </div>

          {linkedCHW?.linked ? (
            <div className="rounded-3xl border border-border/60 bg-card px-5 py-4">
              <div className="flex items-center gap-2 font-medium">
                {linkedCHW.chw_name}
                <BadgeCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" />
                {linkedCHW.phone}
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                {linkedCHW.region}
              </div>
              {linkedCHW.created_at && (
                <p className="text-xs text-muted-foreground mt-3">
                  Linked on {formatDate(linkedCHW.created_at)}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/70 px-5 py-6 text-sm text-muted-foreground">
              No CHW linked yet. Choose one from the registered CHW directory below.
            </div>
          )}
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-sun/30 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h2 className="text-xl">Link a CHW</h2>
              <p className="text-sm text-muted-foreground">Patients can only link a CHW from the available registered list.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
            {selectedCHW ? (
              <div className="space-y-2">
                <div><span className="font-medium text-foreground">{selectedCHW.name}</span></div>
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{selectedCHW.phone || "No phone number on file"}</div>
                <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{selectedCHW.region}</div>
              </div>
            ) : (
              "Select a registered CHW below, then confirm the link."
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setSelectedCHW(null)}>
              Clear
            </Button>
            <Button type="button" disabled={submitting || !selectedCHW?.id} className="rounded-2xl" onClick={() => void handleLink()}>
              {submitting ? "Linking..." : "Link CHW"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl">Available CHWs</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose one registered CHW to enable SMS, realtime talk, and video call.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {registeredDirectory.map((chw) => {
            const isCurrentLink =
              linkedCHW?.linked &&
              linkedCHW.chw_user_id === chw.id;

            return (
              <div key={chw.id} className="card-elevated p-6 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center text-sm font-medium shrink-0">
                    {chw.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{chw.name}</div>
                      <BadgeCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      {chw.region}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      {chw.phone || "No phone number on file"}
                    </div>
                    {chw.email && (
                      <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        {chw.email}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-3">
                      {chw.caseload_count} patients
                      <span className="mx-2">·</span>
                      Registered account
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant={isCurrentLink ? "secondary" : "outline"}
                  className="rounded-2xl"
                  disabled={isCurrentLink}
                  onClick={() => setSelectedCHW(chw)}
                >
                  {isCurrentLink ? "Currently linked" : "Choose CHW"}
                </Button>
              </div>
            );
          })}
        </div>

        {!loading && registeredDirectory.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No registered CHWs found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
