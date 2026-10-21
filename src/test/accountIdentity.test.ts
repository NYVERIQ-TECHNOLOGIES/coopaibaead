import { describe, expect, it } from "vitest";
import { loginIdentifier, missingProfileFields } from "../lib/accountIdentity";

describe("institutional account identity", () => {
  it("uses COOPERAGRE CNPJ as the login identifier", () => {
    expect(loginIdentifier("08.482.873/0001-90")).toBe("cnpj08482873000190@cooperado.coopaiba.com.br");
    expect(loginIdentifier("08482873000190")).toBe("cnpj08482873000190@cooperado.coopaiba.com.br");
  });
  it("does not require CPF for COOPERAGRE", () => {
    expect(missingProfileFields({ cnpj: "08482873000190" }).cpf).toBe(false);
    expect(missingProfileFields({}).cpf).toBe(true);
  });
  it("does not require birthdate for COOPERAGRE but preserves individual requirements", () => {
    expect(missingProfileFields({ cnpj: "08482873000190" }).data_nascimento).toBe(false);
    expect(missingProfileFields({ cpf: "12345678909" }).data_nascimento).toBe(true);
  });
  it("preserves CPF and email logins", () => {
    expect(loginIdentifier("123.456.789-09")).toBe("cpf12345678909@cooperado.coopaiba.com.br");
    expect(loginIdentifier("member@example.com")).toBe("member@example.com");
  });
});