import { useSession } from "@/lib/authClient";
import { Navigate } from "react-router-dom";
import { Spinner } from "./Spinner";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { data: session, isPending } = useSession();

    if (isPending) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (!session) return <Navigate to="/login" replace />;

    return <>{children}</>;
}
