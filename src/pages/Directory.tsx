import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type CHWDirectoryEntry, type CHWLinkStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BadgeCheck, Link2, Mail, MapPin, Phone, UserPlus, Users } from "lucide-react";

type LinkFormState = {
  chw_name: string;
  phone: string;
  region: string;
};

const emptyForm: LinkFormState = {
  chw_name: "",
  phone: "",
  region: "Nairobi",
};

export default function Directory() {
  const { isUser } = useAuth();
  const { toast } = useToast();
  const [directory, setDirectory] = useState<CHWDirectoryEntry[]>([]);
  const [linkedCHW, setLinkedCHW] = useState<CHWLinkStatus | null>(null);
  const [form, setForm] = useState<LinkFormState>(emptyForm);
  const [selectedCHW, setSelectedCHW] = useState<CHWDirectoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const sortedDirectory = useMemo(
    () =>
      [...directory].sort((a, b) => {
        if (a.is_registered !== b.is_registered) return Number(b.is_registered) - Number(a.is_registered);
        return b.caseload_count - a.caseload_count || a.name.localeCompare(b.name);
      }),
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

  const updateForm = (field: keyof LinkFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const useDirectoryEntry = (entry: CHWDirectoryEntry) => {
    setSelectedCHW(entry);
    setForm({
      chw_name: entry.name,
      phone: entry.phone || "",
      region: entry.region || "Nairobi",
    });
  };

  const resetSelection = () => {
    setSelectedCHW(null);
    setForm(emptyForm);
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.chw_name.trim() || !form.phone.trim() || !form.region.trim()) {
      toast({
        title: "Missing details",
        description: "Please provide the CHW name, phone number, and region.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.linkCHW({
        chw_name: form.chw_name.trim(),
        phone: form.phone.trim(),
        region: form.region.trim(),
        chw_user_id: selectedCHW?.is_registered && selectedCHW.id ? selectedCHW.id : undefined,
      });
      toast({ title: "CHW linked", description: `${form.chw_name.trim()} has been added to your support team.` });
      resetSelection();
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
          <p className="text-muted-foreground mt-2">All community health workers and their current coverage.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedDirectory.map((chw) => (
            <div key={`${chw.id ?? chw.name}-${chw.phone}`} className="card-elevated p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center text-sm font-medium shrink-0">
                {chw.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{chw.name}</div>
                  {chw.is_registered && <BadgeCheck className="h-4 w-4 text-primary" />}
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  {chw.region}
                </div>
                {chw.phone && (
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    {chw.phone}
                  </div>
                )}
                {chw.email && (
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    {chw.email}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-3">
                  {chw.caseload_count} patients
                  <span className="mx-2">·</span>
                  {chw.is_registered ? "Registered account" : "Manual listing"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && sortedDirectory.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No CHWs found.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">CHW Support</h1>
        <p className="text-muted-foreground mt-2">Link a Community Health Worker for follow-up care and day-to-day support.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-6">
        <div className="card-elevated p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl">Current CHW Link</h2>
              <p className="text-sm text-muted-foreground">Your latest linked Community Health Worker.</p>
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
              No CHW linked yet. Choose one from the directory or add their details manually.
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
              <p className="text-sm text-muted-foreground">Use a directory entry or add the details yourself.</p>
            </div>
          </div>

          <form onSubmit={handleLink} className="flex flex-col gap-4">
            {selectedCHW && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                Linking to <span className="font-medium">{selectedCHW.name}</span>
                {selectedCHW.is_registered ? " from the registered CHW directory." : "."}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="chw_name">CHW Name</Label>
              <Input
                id="chw_name"
                value={form.chw_name}
                onChange={(e) => updateForm("chw_name", e.target.value)}
                placeholder="Jane Wanjiku"
                className="rounded-2xl h-12"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chw_phone">Phone Number</Label>
                <Input
                  id="chw_phone"
                  value={form.phone}
                  onChange={(e) => updateForm("phone", e.target.value)}
                  placeholder="+254700000000"
                  className="rounded-2xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chw_region">Region</Label>
                <Input
                  id="chw_region"
                  value={form.region}
                  onChange={(e) => updateForm("region", e.target.value)}
                  placeholder="Nairobi"
                  className="rounded-2xl h-12"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={resetSelection}>
                Clear
              </Button>
              <Button type="submit" disabled={submitting} className="rounded-2xl">
                {submitting ? "Linking..." : "Link CHW"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl">Available CHWs</h2>
          <p className="text-sm text-muted-foreground mt-1">Select one to prefill the linking form, then confirm the details.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedDirectory.map((chw) => {
            const isCurrentLink =
              linkedCHW?.linked &&
              linkedCHW.chw_name?.trim().toLowerCase() === chw.name.trim().toLowerCase() &&
              linkedCHW.phone?.trim() === chw.phone.trim();

            return (
              <div key={`${chw.id ?? chw.name}-${chw.phone}`} className="card-elevated p-6 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center text-sm font-medium shrink-0">
                    {chw.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{chw.name}</div>
                      {chw.is_registered && <BadgeCheck className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      {chw.region}
                    </div>
                    {chw.phone && (
                      <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" />
                        {chw.phone}
                      </div>
                    )}
                    {!chw.phone && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Phone number not on file. Add it in the form before linking.
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-3">
                      {chw.caseload_count} patients
                      <span className="mx-2">·</span>
                      {chw.is_registered ? "Registered account" : "Manual listing"}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant={isCurrentLink ? "secondary" : "outline"}
                  className="rounded-2xl"
                  disabled={isCurrentLink}
                  onClick={() => useDirectoryEntry(chw)}
                >
                  {isCurrentLink ? "Currently linked" : "Use Details"}
                </Button>
              </div>
            );
          })}
        </div>

        {!loading && sortedDirectory.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No CHWs found yet. You can still add one manually above.</p>
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
