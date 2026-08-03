import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useUser, SignInButton, useClerk } from "@clerk/clerk-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { Role } from "@/types";
import { Car, User } from "lucide-react";

export function AuthScreen() {
  const { session, refreshProfile } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [role, setRole] = useState<Role>("customer");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<
    "bike" | "auto" | "cabEconomy" | "cabPremium"
  >("bike");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCompleteProfile = async () => {
    if (!session || !user) return;
    if (!phone) {
      toast("error", "Please enter your phone number");
      return;
    }
    if (role === "rider" && !vehiclePlate) {
      toast("error", "Enter your vehicle plate number");
      return;
    }
    setLoading(true);

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: session.user.id,
      role,
      phone,
      full_name: user.fullName || "Anonymous User",
      vehicle_type: role === "rider" ? vehicleType : null,
      vehicle_plate: role === "rider" ? vehiclePlate : null,
    });

    if (profileError) {
      toast("error", "Profile setup failed. Phone may already be in use.");
      setLoading(false);
      return;
    }

    await refreshProfile();
    toast("success", "Welcome to UDRIVE!");
    setLoading(false);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
          <div className="w-16 h-16 rounded-2xl bg-udrive-600 flex items-center justify-center mx-auto mb-6 shadow-md">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Welcome to UDRIVE
          </h1>
          <p className="text-slate-500 mb-8">
            Sign in or create an account to start booking rides or earning as a
            rider.
          </p>

          <div className="space-y-3">
            <SignInButton mode="modal">
              <Button className="w-full h-12 text-base font-semibold bg-udrive-700 hover:bg-udrive-800">
                Continue with Google
              </Button>
            </SignInButton>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding (Session exists, but profile doesn't)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Complete your profile
        </h2>
        <p className="text-slate-500 mb-6">
          Almost there! Choose your role to continue.
        </p>

        <div className="space-y-5">
          {/* Role toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
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

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="+923001234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-udrive-500/20 focus:border-udrive-500 transition-all text-sm"
            />
          </div>

          {role === "rider" && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Vehicle Details
              </p>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Vehicle Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["bike", "auto", "cabEconomy", "cabPremium"] as const).map(
                    (type) => (
                      <button
                        key={type}
                        onClick={() => setVehicleType(type)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium capitalize transition ${
                          vehicleType === type
                            ? "border-udrive-500 bg-udrive-50 text-udrive-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {type.replace("cab", "Cab ")}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  License Plate
                </label>
                <input
                  type="text"
                  placeholder="LER-1234"
                  value={vehiclePlate}
                  onChange={(e) =>
                    setVehiclePlate(e.target.value.toUpperCase())
                  }
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-udrive-500/20 focus:border-udrive-500 transition-all text-sm uppercase"
                />
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col gap-3">
            <Button
              onClick={handleCompleteProfile}
              loading={loading}
              className="w-full h-12 text-base font-semibold bg-udrive-700 hover:bg-udrive-800"
            >
              Complete Setup
            </Button>
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="w-full text-slate-500"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
