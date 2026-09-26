export class GateRefusal extends Error {
  constructor(
    message: string,
    readonly remedy: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "GateRefusal";

    /**
     * A blank remedy is a bug, and it must fail here rather than reach an agent.
     *
     * The paragraph above is a rule the type system cannot hold: `remedy` is a
     * string, and `""` is a string. A refusal that renders `remedy:` with
     * nothing after it is the exact failure this class was written to prevent,
     * and it would ship looking like a working refusal.
     *
     * Codex refuses a refusal that carries no reason, which is
     * the same rule one layer out. Ours was prose; this makes it a check.
     */
    if (!remedy.trim()) {
      throw new Error(`A refusal must name the command that clears it: ${message}`);
    }
  }

  render(): string {
    return [this.message, this.detail, `remedy: ${this.remedy}`]
      .filter((part): part is string => Boolean(part))
      .join("\n");
  }
}

