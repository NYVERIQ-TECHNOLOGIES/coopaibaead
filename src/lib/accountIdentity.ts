export function loginIdentifier(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed.includes("@") && /^[\d.\/\-\s]+$/.test(trimmed)) {
    if (digits.length === 14) return `cnpj${digits}@cooperado.coopaiba.com.br`;
    if (digits.length === 11) return `cpf${digits}@cooperado.coopaiba.com.br`;
  }
  return trimmed;
}

export function missingProfileFields(profile: { cnpj?: string | null; cpf?: string | null; data_nascimento?: string | null; phone?: string | null }) {
  return {
    cpf: !profile.cnpj && !profile.cpf?.trim(),
    data_nascimento: !profile.cnpj && !profile.data_nascimento,
    phone: !profile.phone?.trim(),
  };
}