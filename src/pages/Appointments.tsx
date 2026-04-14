import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Appointment, type Reminder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BellRing, Calendar, Phone, User } from "lucide-react";

export default function Appointments() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [therapist, setTherapist] = useState("");
  const [sessionMode, setSessionMode] = useState("in_person");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);

  const upcomingReminders = useMemo(
    () =>
      [...reminders].sort(
        (a, b) => new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime(),
      ),
    [reminders],
  );

  useEffect(() => {
    void loadAppointmentsPage();
  }, []);

  const loadAppointmentsPage = async () => {
    try {
      const [appointmentsData, remindersData] = await Promise.all([
        api.getAppointments(),
        api.getReminders(),
      ]);
      setAppointments(appointmentsData);
      setReminders(remindersData);
    } catch (err: any) {
      toast({ title: "Unable to load appointments", description: err.message, variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.createAppointment({
        therapist,
        session_mode: sessionMode,
        appointment_time: appointmentTime,
      });
      toast({
        title: "Appointment booked",
        description:
          response.sms_status && response.sms_status !== "skipped"
            ? `You earned ${response.reward_points} reward points, and your reminder was sent by SMS.`
            : `You earned ${response.reward_points} reward points and a reminder was added automatically.`,
      });
      setTherapist("");
      setAppointmentTime("");
      await loadAppointmentsPage();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTitle.trim() || !reminderTime) return;

    setReminderLoading(true);
    try {
      const response = await api.createReminder({ title: reminderTitle.trim(), schedule_time: reminderTime });
      toast({
        title: "Reminder added",
        description:
          response.sms_status && response.sms_status !== "skipped"
            ? "Your custom reminder was saved and sent by SMS."
            : response.sms_warning || "Your custom reminder is ready.",
      });
      setReminderTitle("");
      setReminderTime("");
      const updatedReminders = await api.getReminders();
      setReminders(updatedReminders);
    } catch (err: any) {
      toast({ title: "Unable to save reminder", description: err.message, variant: "destructive" });
    } finally {
      setReminderLoading(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">Appointments</h1>
        <p className="text-muted-foreground mt-2">Book therapy sessions and keep your reminders in one place.</p>
      </header>

      <div className="card-elevated p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="therapist">Therapist Name</Label>
              <Input
                id="therapist"
                value={therapist}
                onChange={(e) => setTherapist(e.target.value)}
                placeholder="Dr. Smith"
                required
                className="rounded-2xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment_time">Date & Time</Label>
              <Input
                id="appointment_time"
                type="datetime-local"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                required
                className="rounded-2xl h-12"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Session Mode</Label>
            <div className="flex gap-3 flex-wrap">
              {["in_person", "video", "phone"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSessionMode(mode)}
                  className={`px-5 py-2.5 rounded-2xl border text-sm font-medium transition-all capitalize ${
                    sessionMode === mode
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {mode.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={loading} className="rounded-2xl h-11 self-end px-8">
            {loading ? "Booking..." : "Book Appointment"}
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-6 items-start">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-xl">Upcoming Sessions</h2>
            <p className="text-sm text-muted-foreground mt-1">Your booked sessions, ready for follow-up or a quick call.</p>
          </div>

          {appointments.map((appointment) => (
            <div key={appointment.id} className="card-elevated p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{appointment.therapist}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDateTime(appointment.appointment_time)}
                    <span className="capitalize">· {appointment.session_mode.replace("_", " ")}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Link to="/care-chat">
                    <Phone className="h-3.5 w-3.5" />
                    Open Care Chat
                  </Link>
                </Button>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    appointment.status === "booked" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {appointment.status}
                </span>
              </div>
            </div>
          ))}

          {appointments.length === 0 && (
            <div className="card-elevated p-8 text-center text-muted-foreground">
              No sessions booked yet. Your next appointment will appear here.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-sun/30 flex items-center justify-center">
                <BellRing className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h2 className="text-xl">Add Reminder</h2>
                <p className="text-sm text-muted-foreground">Create a custom reminder for therapy, journaling, or medication.</p>
              </div>
            </div>

            <form onSubmit={handleReminderSubmit} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="reminder_title">Reminder Title</Label>
                <Input
                  id="reminder_title"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder="Prepare for therapy"
                  className="rounded-2xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reminder_time">Date & Time</Label>
                <Input
                  id="reminder_time"
                  type="datetime-local"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="rounded-2xl h-12"
                />
              </div>
              <Button type="submit" disabled={reminderLoading} className="rounded-2xl">
                {reminderLoading ? "Saving..." : "Save Reminder"}
              </Button>
            </form>
          </div>

          <div className="card-elevated p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-xl">Upcoming Reminders</h2>
              <p className="text-sm text-muted-foreground mt-1">Appointments automatically create reminders here too.</p>
            </div>

            {upcomingReminders.map((reminder) => (
              <div key={reminder.id} className="rounded-2xl border border-border/70 px-4 py-3">
                <div className="font-medium">{reminder.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{formatDateTime(reminder.schedule_time)}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  {reminder.is_active ? "Active reminder" : "Inactive reminder"}
                </div>
              </div>
            ))}

            {upcomingReminders.length === 0 && (
              <div className="text-sm text-muted-foreground">No reminders yet. Book a session or add one above.</div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
