import { useState } from 'react';

import type { CustomCategory } from '../../domain/categories/custom-category';

export type CategoryCreateFormProps = Readonly<{
  onCreateCategory: (
    name: string,
    emoji: string,
  ) => Promise<CustomCategory | undefined>;
  onCreated: (category: CustomCategory) => void;
  onCancel: () => void;
  disabled?: boolean;
}>;

export function CategoryCreateForm({
  onCreateCategory,
  onCreated,
  onCancel,
  disabled = false,
}: CategoryCreateFormProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (isSaving || disabled) {
      return;
    }

    setIsSaving(true);
    setError(null);
    const category = await onCreateCategory(name, emoji);
    setIsSaving(false);

    if (category === undefined) {
      setError('카테고리 이름을 한 글자 이상 입력해 주세요.');
      return;
    }

    onCreated(category);
  };

  return (
    <div className="category-create-form">
      <div className="category-create-form__heading">
        <strong>새 카테고리</strong>
        <small>내 거래에만 저장되는 이름이에요.</small>
      </div>
      <label>
        이름
        <input
          type="text"
          aria-label="새 카테고리 이름"
          value={name}
          maxLength={30}
          placeholder="예: 반려동물"
          disabled={disabled || isSaving}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        아이콘
        <input
          type="text"
          aria-label="새 카테고리 아이콘"
          value={emoji}
          maxLength={8}
          disabled={disabled || isSaving}
          onChange={(event) => setEmoji(event.target.value)}
        />
      </label>
      {error === null ? null : (
        <p className="category-create-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="category-create-form__actions">
        <button type="button" onClick={onCancel} disabled={disabled || isSaving}>
          취소
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={disabled || isSaving || name.trim().length === 0}
        >
          {isSaving ? '추가 중' : '카테고리 추가'}
        </button>
      </div>
    </div>
  );
}
