export type BudgetBucketId = string;

export type BudgetBucket = Readonly<{
  id: BudgetBucketId;
  name: string;
  icon: string;
  order: number;
  isDefault: boolean;
  isArchived: boolean;
}>;

export type BudgetBucketValidationIssue = Readonly<{
  field: string;
  code:
    | 'invalid_root'
    | 'required'
    | 'invalid_id'
    | 'invalid_text'
    | 'invalid_order'
    | 'invalid_boolean'
    | 'unexpected_field';
}>;

export type BudgetBucketValidationResult =
  | Readonly<{ isValid: true; value: BudgetBucket }>
  | Readonly<{
      isValid: false;
      issues: readonly BudgetBucketValidationIssue[];
    }>;

export const DEFAULT_BUDGET_BUCKETS: readonly BudgetBucket[] = [
  {
    id: 'LIVING',
    name: '생활비',
    icon: '🏠',
    order: 10,
    isDefault: true,
    isArchived: false,
  },
  {
    id: 'IRREGULAR',
    name: '비정기비',
    icon: '📅',
    order: 20,
    isDefault: true,
    isArchived: false,
  },
  {
    id: 'EMERGENCY',
    name: '비상금',
    icon: '🛟',
    order: 30,
    isDefault: true,
    isArchived: false,
  },
  {
    id: 'SAVING',
    name: '저축',
    icon: '🐷',
    order: 40,
    isDefault: true,
    isArchived: false,
  },
  {
    id: 'HOUSING_MARRIAGE',
    name: '주거·결혼',
    icon: '💍',
    order: 50,
    isDefault: true,
    isArchived: false,
  },
  {
    id: 'INVESTMENT',
    name: '투자',
    icon: '📈',
    order: 60,
    isDefault: true,
    isArchived: false,
  },
  {
    id: 'OTHER',
    name: '기타',
    icon: '🗂️',
    order: 70,
    isDefault: true,
    isArchived: false,
  },
];

const BUDGET_BUCKET_FIELDS = [
  'id',
  'name',
  'icon',
  'order',
  'isDefault',
  'isArchived',
] as const;
const budgetBucketFieldSet: ReadonlySet<string> = new Set(BUDGET_BUCKET_FIELDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonBlankText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

export function isBudgetBucketId(value: unknown): value is BudgetBucketId {
  return isNonBlankText(value, 80) && !/\s/.test(value);
}

export function getDefaultBudgetBucket(
  id: BudgetBucketId,
): BudgetBucket | undefined {
  return DEFAULT_BUDGET_BUCKETS.find((bucket) => bucket.id === id);
}

export function validateBudgetBucket(
  candidate: unknown,
): BudgetBucketValidationResult {
  if (!isRecord(candidate)) {
    return {
      isValid: false,
      issues: [{ field: '$root', code: 'invalid_root' }],
    };
  }

  const issues: BudgetBucketValidationIssue[] = [];
  const addIssue = (
    field: BudgetBucketValidationIssue['field'],
    code: BudgetBucketValidationIssue['code'],
  ) => issues.push({ field, code });
  const readRequired = (field: 'id' | 'name' | 'icon') => {
    if (candidate[field] === undefined) {
      addIssue(field, 'required');
      return null;
    }
    return candidate[field];
  };

  const idCandidate = readRequired('id');
  const nameCandidate = readRequired('name');
  const iconCandidate = readRequired('icon');
  const id = isBudgetBucketId(idCandidate) ? idCandidate : null;
  const name = isNonBlankText(nameCandidate, 40) ? nameCandidate : null;
  const icon = isNonBlankText(iconCandidate, 16) ? iconCandidate : null;

  if (idCandidate !== null && id === null) {
    addIssue('id', 'invalid_id');
  }
  if (nameCandidate !== null && name === null) {
    addIssue('name', 'invalid_text');
  }
  if (iconCandidate !== null && icon === null) {
    addIssue('icon', 'invalid_text');
  }

  const orderCandidate = candidate.order;
  const order =
    typeof orderCandidate === 'number' &&
    Number.isSafeInteger(orderCandidate) &&
    orderCandidate >= 0
      ? orderCandidate
      : null;
  if (orderCandidate === undefined) {
    addIssue('order', 'required');
  } else if (order === null) {
    addIssue('order', 'invalid_order');
  }

  const isDefaultCandidate = candidate.isDefault;
  const isDefault =
    typeof isDefaultCandidate === 'boolean' ? isDefaultCandidate : null;
  if (isDefaultCandidate === undefined) {
    addIssue('isDefault', 'required');
  } else if (isDefault === null) {
    addIssue('isDefault', 'invalid_boolean');
  }

  const isArchivedCandidate = candidate.isArchived;
  const isArchived =
    typeof isArchivedCandidate === 'boolean' ? isArchivedCandidate : null;
  if (isArchivedCandidate === undefined) {
    addIssue('isArchived', 'required');
  } else if (isArchived === null) {
    addIssue('isArchived', 'invalid_boolean');
  }

  if (Object.keys(candidate).some((field) => !budgetBucketFieldSet.has(field))) {
    addIssue('$root', 'unexpected_field');
  }

  if (
    issues.length > 0 ||
    id === null ||
    name === null ||
    icon === null ||
    order === null ||
    isDefault === null ||
    isArchived === null
  ) {
    return { isValid: false, issues };
  }

  return {
    isValid: true,
    value: { id, name, icon, order, isDefault, isArchived },
  };
}
