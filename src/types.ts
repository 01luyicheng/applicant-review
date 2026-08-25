export interface Applicant {
  id: string;
  raw: Record<string, string>;
}

export interface FieldConfig {
  key: string;
  label: string;
  multiline?: boolean;
  visibleInList?: boolean;
  // 通用化扩展（可选，向后兼容）
  type?: 'text' | 'textarea' | 'number' | 'date' | 'email' | 'url' | 'select' | 'multiselect' | 'attachment' | 'rating' | 'boolean' | 'currency' | 'phone';
  options?: string[];
  width?: number;
  sortable?: boolean;
  searchable?: boolean;
  required?: boolean;
  filter?: 'exact' | 'range' | 'search';
}

export interface StatusValue {
  value: string;
  label: string;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray';
}

export interface ViewConfig {
  title: string;
  idField: string;
  nameField: string;
  listFields: FieldConfig[];
  detailGroups: { label: string; fields: FieldConfig[] }[];
  statusField: string;
  statusValues: StatusValue[];
  sensitiveKeys?: string[];
  /** 列映射触发阈值，默认 0.3（30% 字段缺失时弹出映射） */
  mappingThreshold?: number;
}

/**
 * 通用最小模板（generic）：与 public/config.json / public/config-examples/generic.json 保持一致
 * 不再硬编码黑客松长问，便于任意活动复用
 */
export const DEFAULT_CONFIG: ViewConfig = {
  title: '活动报名审核',
  idField: '编号',
  nameField: '姓名',
  listFields: [
    { key: '姓名', label: '姓名', visibleInList: true },
    { key: '邮箱', label: '邮箱', visibleInList: true },
    { key: '状态', label: '状态', visibleInList: true },
    { key: '备注', label: '备注', visibleInList: true },
  ],
  detailGroups: [
    { label: '基本信息', fields: [
      { key: '姓名', label: '姓名' },
      { key: '邮箱', label: '邮箱' },
      { key: '手机号', label: '手机号' },
    ]},
    { label: '审核状态', fields: [
      { key: '状态', label: '状态' },
      { key: '备注', label: '备注', multiline: true },
    ]},
  ],
  statusField: '状态',
  statusValues: [
    { value: '', label: '待审核', color: 'gray' },
    { value: '通过', label: '通过', color: 'green' },
    { value: '拒绝', label: '拒绝', color: 'red' },
  ],
};

export type ReviewStatus = string;

export interface FilterState {
  search: string;
  status: string;
  custom: Record<string, string>;
}

export interface Stats {
  total: number;
  counts: Record<string, number>;
  pending: number;
}