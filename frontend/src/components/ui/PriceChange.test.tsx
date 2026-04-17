import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceChange } from "./PriceChange";

describe("PriceChange", () => {
    it("should show positive change with + prefix in green", () => {
        render(<PriceChange value={1.5} percent={0.75} />);
        const el = screen.getByText(/\+1\.50/);
        expect(el).toBeInTheDocument();
        expect(el).toHaveClass("text-gain");
    });

    it("should show negative change in red", () => {
        render(<PriceChange value={-2.3} percent={-1.2} />);
        const el = screen.getByText(/-2\.30/);
        expect(el).toBeInTheDocument();
        expect(el).toHaveClass("text-loss");
    });

    it("should format percentage correctly", () => {
        render(<PriceChange value={0} percent={0} />);
        expect(screen.getByText(/\+0\.00/)).toBeInTheDocument();
    });

    it("should support different sizes", () => {
        const { container } = render(<PriceChange value={1.0} percent={0.5} size="lg" />);
        const span = container.querySelector("span");
        expect(span).toHaveClass("text-base");
    });
});
