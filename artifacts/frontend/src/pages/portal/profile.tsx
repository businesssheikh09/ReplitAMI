import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePortalAuth } from "@/lib/portal-auth";
import { PortalLayout } from "@/components/portal-layout";
import { User, Lock, Save, CheckCircle2 } from "lucide-react";

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
      />
    </div>
  );
}

export default function PortalProfilePage() {
  const { user, token, login } = usePortalAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [address, setAddress] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSaved, setPwdSaved] = useState(false);

  const updateProfile = useMutation({
    mutationFn: () =>
      fetch("/api/portal/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName, phone, email, companyName, ownerName, address, whatsapp }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (user && token) login(token, { ...user, fullName: data.fullName ?? user.fullName, email: data.email ?? user.email, phone: data.phone ?? user.phone });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    },
  });

  const changePassword = useMutation({
    mutationFn: () =>
      fetch("/api/portal/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) { setPwdError(data.error); return; }
      setPwdSaved(true);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      setTimeout(() => setPwdSaved(false), 3000);
    },
  });

  const handlePasswordChange = () => {
    setPwdError("");
    if (!currentPwd) { setPwdError("Enter your current password"); return; }
    if (newPwd.length < 6) { setPwdError("New password must be at least 6 characters"); return; }
    if (newPwd !== confirmPwd) { setPwdError("Passwords do not match"); return; }
    changePassword.mutate();
  };

  return (
    <PortalLayout>
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500">Update your account details</p>
        </div>

        {/* Profile form */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-teal-600" />
            <h2 className="text-sm font-bold text-gray-800">Personal Information</h2>
          </div>

          <div className="space-y-3">
            <Field label="Full Name" value={fullName} onChange={setFullName} />
            <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
            <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} type="tel" />
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <Field label="Company Name" value={companyName} onChange={setCompanyName} />
            <Field label="Owner Name" value={ownerName} onChange={setOwnerName} />
            <Field label="Address" value={address} onChange={setAddress} />
          </div>

          <button
            onClick={() => updateProfile.mutate()}
            disabled={updateProfile.isPending}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-60"
          >
            {profileSaved ? <><CheckCircle2 className="h-4 w-4" /> Saved!</> : <><Save className="h-4 w-4" />{updateProfile.isPending ? "Saving…" : "Save Changes"}</>}
          </button>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-teal-600" />
            <h2 className="text-sm font-bold text-gray-800">Change Password</h2>
          </div>

          <div className="space-y-3">
            <Field label="Current Password" value={currentPwd} onChange={setCurrentPwd} type="password" />
            <Field label="New Password" value={newPwd} onChange={setNewPwd} type="password" />
            <Field label="Confirm New Password" value={confirmPwd} onChange={setConfirmPwd} type="password" />
          </div>

          {pwdError && <p className="mt-2 text-xs text-red-600">{pwdError}</p>}

          <button
            onClick={handlePasswordChange}
            disabled={changePassword.isPending}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
          >
            {pwdSaved ? <><CheckCircle2 className="h-4 w-4" /> Changed!</> : <><Lock className="h-4 w-4" />{changePassword.isPending ? "Updating…" : "Update Password"}</>}
          </button>
        </div>
      </div>
    </PortalLayout>
  );
}
