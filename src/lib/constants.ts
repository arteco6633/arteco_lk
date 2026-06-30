import { OrderStatus, PartStatus, Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер / технолог",
  CONTRACTOR: "Приёмка у подрядчика",
  SORTER: "Сортировка в цеху",
  DRILLER: "Присадка",
  QC: "ОКК",
  PACKER: "Упаковка",
};

export const STATUS_LABELS: Record<PartStatus, string> = {
  CREATED: "Создана",
  RECEIVED: "Принята у подрядчика",
  SORTED: "Отсортирована",
  DRILLED: "Присадка выполнена",
  QC_PASSED: "ОКК пройден",
  QC_FAILED: "ОКК брак",
  PACKED: "Упакована",
};

export const STATUS_COLORS: Record<PartStatus, string> = {
  CREATED: "bg-gray-100 text-gray-800",
  RECEIVED: "bg-blue-100 text-blue-800",
  SORTED: "bg-indigo-100 text-indigo-800",
  DRILLED: "bg-amber-100 text-amber-800",
  QC_PASSED: "bg-green-100 text-green-800",
  QC_FAILED: "bg-red-100 text-red-800",
  PACKED: "bg-emerald-100 text-emerald-800",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Новый",
  PROCUREMENT: "Закупка",
  PRODUCTION: "В производстве",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

export const DOCUMENT_TYPE_LABELS = {
  ASSEMBLY_DRAWING: "Сборочный чертёж",
  PART_DETAIL: "Деталировка",
  LABEL: "Бирка",
} as const;

export const WORKFLOW_LINKS = [
  { href: "/workflow/receipt", label: "Приёмка", roles: ["ADMIN", "CONTRACTOR", "MANAGER"] as Role[] },
  { href: "/workflow/sort", label: "Сортировка", roles: ["ADMIN", "SORTER", "MANAGER"] as Role[] },
  { href: "/workflow/drill", label: "Присадка", roles: ["ADMIN", "DRILLER", "MANAGER"] as Role[] },
  { href: "/workflow/qc", label: "ОКК", roles: ["ADMIN", "QC", "MANAGER"] as Role[] },
  { href: "/workflow/pack", label: "Упаковка", roles: ["ADMIN", "PACKER", "MANAGER"] as Role[] },
];

export function canAccess(role: Role, allowed: Role[]): boolean {
  return role === "ADMIN" || allowed.includes(role);
}

export function homeForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "CONTRACTOR":
      return "/workflow/receipt";
    case "SORTER":
      return "/workflow/sort";
    case "DRILLER":
      return "/workflow/drill";
    case "QC":
      return "/workflow/qc";
    case "PACKER":
      return "/workflow/pack";
    default:
      return "/orders";
  }
}
