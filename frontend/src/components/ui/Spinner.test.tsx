import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
    it("should render a spinning element", () => {
        const { container } = render(<Spinner />);
        const spinner = container.querySelector(".animate-spin");
        expect(spinner).toBeInTheDocument();
    });
});
