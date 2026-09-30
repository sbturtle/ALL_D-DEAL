// 사용자가 고른 로컬 금융 폴더에서 최신 XLS 하나를 받아 기존 Preview 흐름에 넘기는 port다.
// 폴더 경로와 원본 파일명은 결과에 담지 않고 File 객체만 전달한다.

export type LocalFinanceDirectoryPickResult =
  | Readonly<{ status: 'SELECTED'; file: File }>
  | Readonly<{ status: 'CANCELLED' }>
  | Readonly<{ status: 'EMPTY' }>;

export type LatestLocalFinanceXlsPicker = () => Promise<LocalFinanceDirectoryPickResult>;
