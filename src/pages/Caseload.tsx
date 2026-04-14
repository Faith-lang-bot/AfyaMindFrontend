import { useEffect, useState } from "react";
import { api, type CHWCaseload, type CHWCaseloadPatient } from "@/lib/api";
import { AlertTriangle, MessageSquareHeart, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Caseload() {
  const { toast } = useToast();
  const [caseload, setCaseload] = useState<CHWCaseload | null>(null);
  const [loadingPatientId, setLoadingPatientId] = useState<number | null>(null);

  useEffect(() => {
    void loadCaseload();
  }, []);

  const loadCaseload = async () => {
    try {
      setCaseload(await api.getCHWCaseload());
    } catch (error: any) {
      toast({
        title: "Unable to load caseload",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSendMotivation = async (patient: CHWCaseloadPatient) => {
    if (!patient.patient_phone?.trim()) {
      toast({
        title: "Missing patient phone",
        description: "This patient needs a phone number on file before SMS motivation can be sent.",
        variant: "destructive",
      });
      return;
    }

    setLoadingPatientId(patient.patient_id);
    try {
      const response = await api.sendMotivation({
        to: patient.patient_phone.trim(),
        language: patient.language,
      });
      toast({
        title: "Motivation sent by SMS",
        description: response.message,
      });
    } catch (error: any) {
      toast({
        title: "Unable to send motivation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingPatientId(null);
    }
  };

  const riskColor = (level: string) => {
    switch (level) {
      case "high":
        return "bg-destructive/10 text-destructive";
      case "medium":
        return "bg-sun/50 text-foreground";
      default:
        return "bg-sage/20 text-foreground";
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">Your Caseload</h1>
        <p className="text-muted-foreground mt-2">
          {caseload ? `${caseload.total_patients} patients assigned to you` : "Loading..."}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {caseload?.patients?.map((patient) => {
          const isSending = loadingPatientId === patient.patient_id;

          return (
            <div key={patient.patient_id} className="card-elevated p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">
                    {patient.patient_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{patient.patient_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {patient.region} · {patient.total_checkins} check-ins
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Phone className="h-3.5 w-3.5" />
                      {patient.patient_phone || "No phone number on file"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {patient.last_risk_level === "high" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${riskColor(patient.last_risk_level)}`}>
                    {patient.last_risk_level}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={isSending}
                  onClick={() => void handleSendMotivation(patient)}
                >
                  <MessageSquareHeart className="mr-2 h-4 w-4" />
                  {isSending ? "Sending..." : "Send SMS Motivation"}
                </Button>
              </div>
            </div>
          );
        })}

        {caseload?.patients?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No patients assigned yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
