import { Component, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    message: string;
}

export class ChartErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, message: "" };
    }

    static getDerivedStateFromError(error: unknown): State {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { hasError: true, message };
    }

    handleReset = () => {
        this.setState({ hasError: false, message: "" });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-full flex-col items-center justify-center gap-4 border border-gray-800 text-gray-400">
                    <p className="text-sm">Chart failed to render: {this.state.message}</p>
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-1.5 rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800 transition-colors"
                    >
                        <RotateCcw size={12} />
                        Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
