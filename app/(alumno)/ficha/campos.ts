export const CAMPOS_FICHA = [
  { name: "lesiones", label: "Lesiones" },
  { name: "medicacion", label: "Medicación" },
  { name: "suplementos", label: "Suplementos" },
  { name: "cirugias", label: "Cirugías" },
  { name: "alcohol", label: "Alcohol" },
  { name: "tabaco", label: "Tabaco" },
  { name: "plan_nutricional", label: "Plan nutricional" },
  { name: "actividad_laboral", label: "Actividad laboral" },
  { name: "actividad_fisica_actual", label: "Actividad física actual" },
] as const;

export type CampoFicha = (typeof CAMPOS_FICHA)[number]["name"];
