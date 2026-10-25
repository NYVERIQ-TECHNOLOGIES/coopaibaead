import { describe, it, expect } from "vitest";
import { validateNewPassword } from "@/components/ForcePasswordChange";

describe("troca obrigatória da senha temporária", () => {
  it("exige a senha atual", () => {
    expect(validateNewPassword("", "NovaSenha1", "NovaSenha1")).not.toBeNull();
  });
  it("recusa nova senha igual à temporária", () => {
    expect(validateNewPassword("Coopaiba2026@", "Coopaiba2026@", "Coopaiba2026@")).not.toBeNull();
  });
  it("recusa senha com menos de 8 caracteres", () => {
    expect(validateNewPassword("ifal@2026", "abc123", "abc123")).not.toBeNull();
  });
  it("recusa confirmação diferente", () => {
    expect(validateNewPassword("ifal@2026", "NovaSenha1", "NovaSenha2")).not.toBeNull();
  });
  it("aceita senha válida", () => {
    expect(validateNewPassword("ifal@2026", "NovaSenha1", "NovaSenha1")).toBeNull();
  });
});
