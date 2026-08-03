import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { Role } from "@/types";
import {
  Car,
  User,
  Phone,
  Mail,
  ArrowLeft,
  Bike,
  Truck,
  Users,
  MapPin,
  Radio,
  Wallet,
  Shield,
  TrendingUp,
} from "lucide-react";

export function AuthScreen() {
  const { refreshProfile } = useAuth();
  const [mode, setMode] = useState<"landing" | "signin" | "signup">("landing");
  const [role, setRole] = useState<Role>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<
    "bike" | "auto" | "cabEconomy" | "cabPremium"
  >("bike");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSignIn = async () => {
    if (!email || !password) {
      toast("error", "Enter email and password");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      toast("error", error.message);
      setLoading(false);
      return;
    }
    await refreshProfile();
    toast("success", "Welcome back to UDRIVE!");
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!email || !password || !fullName || !phone) {
      toast("error", "Please fill all fields");
      return;
    }
    if (role === "rider" && !vehiclePlate) {
      toast("error", "Enter your vehicle plate number");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role, phone },
      },
    });
    if (error) {
      toast("error", error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: data.user.id,
          role,
          phone,
          full_name: fullName,
          vehicle_type: role === "rider" ? vehicleType : null,
          vehicle_plate: role === "rider" ? vehiclePlate : null,
        });
      if (profileError) {
        toast("error", "Account created but profile setup failed. Phone may already be in use.");
        setLoading(false);
        return;
      }
    }
    await refreshProfile();
    toast("success", "Welcome to UDRIVE!");
    setLoading(false);
  };

  if (mode === "landing") return <Landing onChoose={setMode} />;

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-udrive-800 via-udrive-700 to-udrive-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent-400 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <button
            onClick={() => setMode("landing")}
            className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium w-fit"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Car className="w-7 h-7" />
              </div>
              <span className="text-2xl font-bold tracking-tight">UDRIVE</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight mb-4">
              {mode === "signin"
                ? "Welcome back to the ride"
                : "Join the UDRIVE community"}
            </h1>
            <p className="text-white/70 text-lg max-w-md">
              Book bikes, autos, and cabs with live tracking, transparent fares,
              and nearby riders on OpenStreetMap.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat value="8+" label="Demo riders" />
            <Stat value="60km" label="Search radius" />
            <Stat value="4 types" label="Vehicles" />
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md udrive-fade-in">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-udrive-700 flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">UDRIVE</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {mode === "signin"
              ? "Enter your details to continue"
              : "Choose your role and get started"}
          </p>

          {/* Role toggle - only for signup */}
          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-5">
              <button
                onClick={() => setRole("customer")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
                  role === "customer"
                    ? "bg-white text-udrive-700 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                <User className="w-4 h-4" /> Customer
              </button>
              <button
                onClick={() => setRole("rider")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
                  role === "rider"
                    ? "bg-white text-udrive-700 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                <Car className="w-4 h-4" /> Rider
              </button>
            </div>
          )}

          <div className="space-y-3.5">
            {mode === "signup" && (
              <Field
                label="Full name"
                icon={<User className="w-4 h-4" />}
                value={fullName}
                onChange={setFullName}
                placeholder="Ahmed Khan"
              />
            )}
            <Field
              label="Email"
              icon={<Mail className="w-4 h-4" />}
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
            />
            <Field
              label="Password"
              icon={<Phone className="w-4 h-4" />}
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              type="password"
            />
            <Field
              label="Phone"
              icon={<Phone className="w-4 h-4" />}
              value={phone}
              onChange={setPhone}
              placeholder="+92 300 1234567"
              type="tel"
            />

            {mode === "signup" && role === "rider" && (
              <div className="space-y-3.5 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">
                  Vehicle details
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["bike", "Bike", Bike],
                      ["auto", "Auto", Truck],
                      ["cabEconomy", "Cab Eco", Car],
                      ["cabPremium", "Cab Premium", Car],
                    ] as const
                  ).map(([v, lbl, Icon]) => (
                    <button
                      key={v}
                      onClick={() => setVehicleType(v)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition ${
                        vehicleType === v
                          ? "border-udrive-500 bg-udrive-50 text-udrive-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {lbl}
                    </button>
                  ))}
                </div>
                <Field
                  label="Vehicle plate"
                  icon={<Users className="w-4 h-4" />}
                  value={vehiclePlate}
                  onChange={setVehiclePlate}
                  placeholder="LEK-1234"
                />
              </div>
            )}

            <Button
              fullWidth
              size="lg"
              loading={loading}
              onClick={mode === "signin" ? handleSignIn : handleSignUp}
              className="mt-2"
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-5">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() =>
                setMode(mode === "signin" ? "signup" : "signin")
              }
              className="text-udrive-700 font-semibold hover:underline"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>

          {mode === "signin" && (
            <div className="mt-6 p-4 rounded-xl bg-udrive-50 border border-udrive-100">
              <p className="text-xs font-semibold text-udrive-800 mb-1">
                Try a demo rider account
              </p>
              <p className="text-xs text-udrive-700">
                Email: <span className="font-mono">rider1@udrive.demo</span>
                <br />
                Password: <span className="font-mono">rider123</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-udrive-500 focus:ring-2 focus:ring-udrive-100 transition"
        />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-white/60">{label}</div>
    </div>
  );
}

function Landing({ onChoose }: { onChoose: (m: "signin" | "signup") => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-udrive-50">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-udrive-800 via-udrive-700 to-udrive-900" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-20 w-96 h-96 rounded-full bg-accent-400 blur-3xl" />
        </div>

        <header className="relative z-10 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Car className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">UDRIVE</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onChoose("signin")}
              className="text-white/80 hover:text-white text-sm font-medium px-4 py-2"
            >
              Sign in
            </button>
            <button
              onClick={() => onChoose("signup")}
              className="bg-white text-udrive-800 hover:bg-udrive-50 text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm"
            >
              Get started
            </button>
          </div>
        </header>

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-white/90 text-sm px-4 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
            Live on OpenStreetMap
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight max-w-3xl mx-auto leading-tight">
            Ride anywhere. Anytime.
          </h1>
          <p className="text-white/70 text-lg mt-5 max-w-xl mx-auto">
            Book bikes, autos, and cabs with live tracking, transparent fares,
            and real-time nearby riders on an interactive map.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => onChoose("signup")}
              className="bg-white text-udrive-800 hover:bg-udrive-50 font-semibold px-6 py-3.5 rounded-xl transition shadow-lg"
            >
              Get started free
            </button>
            <button
              onClick={() => onChoose("signin")}
              className="bg-white/10 backdrop-blur text-white hover:bg-white/20 font-semibold px-6 py-3.5 rounded-xl transition border border-white/20"
            >
              I have an account
            </button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-50 to-transparent" />
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 -mt-16 relative z-10 pb-20">
        <div className="grid md:grid-cols-3 gap-5">
          <FeatureCard
            icon={<MapPin />}
            title="Live OpenStreetMap"
            desc="See nearby riders, your pickup and drop, and the full route on a beautiful interactive map with radius visualization."
          />
          <FeatureCard
            icon={<Radio />}
            title="Real-time tracking"
            desc="Watch your rider approach in real time. Get OTP-verified starts, arrival alerts, and live status updates."
          />
          <FeatureCard
            icon={<Wallet />}
            title="Transparent fares"
            desc="Know your fare before you book. Choose from bike, auto, economy, or premium — no surprises."
          />
          <FeatureCard
            icon={<Bike />}
            title="4 vehicle types"
            desc="From quick bikes to premium cabs. Pick the ride that fits your trip and budget."
          />
          <FeatureCard
            icon={<Shield />}
            title="OTP-verified rides"
            desc="Every ride starts with a 4-digit OTP shared with the rider — safety you can count on."
          />
          <FeatureCard
            icon={<TrendingUp />}
            title="Rider dashboard"
            desc="Riders get a live duty toggle, incoming ride offers, earnings tracking, and ride history."
          />
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-card hover:shadow-cardhover transition group">
      <div className="w-12 h-12 rounded-xl bg-udrive-50 text-udrive-700 flex items-center justify-center mb-4 group-hover:scale-110 transition">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}
