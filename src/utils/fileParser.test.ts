import { describe, it, expect } from 'vitest';
import { calculateStats, getUniqueValues, exportToCSV, parseFile } from './fileParser';
import type { ViewConfig } from '../types';
import * as XLSX from 'xlsx';

const baseConfig: ViewConfig = {
  title: '测试',
  idField: '编号',
  nameField: '姓名',
  listFields: [
    { key: '姓名', label: '姓名', visibleInList: true },
    { key: '赛道', label: '赛道', visibleInList: true },
  ],
  detailGroups: [{ label: '详情', fields: [{ key: '备注', label: '备注' }] }],
  statusField: '审核是否通过',
  statusValues: [
    { value: '', label: '待审核', color: 'gray' },
    { value: '通过', label: '通过', color: 'green' },
    { value: '拒绝', label: '拒绝', color: 'red' },
  ],
};

describe('calculateStats', () => {
  it('空数组', () => {
    const s = calculateStats([], '审核是否通过', baseConfig.statusValues);
    expect(s.total).toBe(0);
    expect(s.pending).toBe(0);
    expect(s.counts['']).toBe(0);
  });
  it('统计各状态', () => {
    const apps = [
      { id:'1', raw:{ '审核是否通过':'通过'}},
      { id:'2', raw:{ '审核是否通过':'拒绝'}},
      { id:'3', raw:{ '审核是否通过':''}},
      { id:'4', raw:{}},
    ];
    const s = calculateStats(apps as any, '审核是否通过', baseConfig.statusValues);
    expect(s.total).toBe(4);
    expect(s.counts['通过']).toBe(1);
    expect(s.counts['拒绝']).toBe(1);
    expect(s.pending).toBe(2); // '' + missing
  });
});

describe('getUniqueValues', () => {
  it('去重排序过滤空', () => {
    const apps = [
      { id:'1', raw:{ 赛道:'A'}},
      { id:'2', raw:{ 赛道:'B'}},
      { id:'3', raw:{ 赛道:'A'}},
      { id:'4', raw:{ 赛道:''}},
    ];
    expect(getUniqueValues(apps as any, '赛道')).toEqual(['A','B']);
  });
});

describe('exportToCSV', () => {
  it('空数组返回空串', () => {
    expect(exportToCSV([], baseConfig)).toBe('');
  });
  it('表头与状态label映射', () => {
    const apps = [
      { id:'1', raw:{ '姓名':'张三', '赛道':'AI', '审核是否通过':'通过', '备注':'hello'}},
    ];
    const csv = exportToCSV(apps as any, baseConfig);
    // 表头含 序号 + 姓名/赛道/备注/审核状态（通过 labelMap）
    expect(csv.split('\n')[0]).toContain('序号');
    expect(csv.split('\n')[0]).toContain('姓名');
    // 状态 value '通过' 应导出 label '通过'
    expect(csv).toContain('通过');
  });
  it('CSV注入防护加前缀', () => {
    const apps = [
      { id:'1', raw:{ '姓名':'=HYPERLINK("a")', '赛道':'+123', '审核是否通过':''}},
    ];
    const csv = exportToCSV(apps as any, baseConfig);
    // 注入单元格应被 "'=" 前缀包裹在引号内
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+123");
  });
  it('含逗号双引号换行转义', () => {
    const apps = [
      { id:'1', raw:{ '姓名':'a,\"b\nc', '赛道':'x', '审核是否通过':''}},
    ];
    const csv = exportToCSV(apps as any, baseConfig);
    // 双引号应翻倍
    expect(csv).toContain('""');
    // 整单元格被引号包裹
    expect(csv).toContain('"a,');
  });
  it('回退路径：rawKeys为空走config', () => {
    // 制造 raw 为空对象，触发 seen 去重分支
    const apps = [{ id:'1', raw:{} }];
    const csv = exportToCSV(apps as any, baseConfig);
    expect(csv).toContain('序号');
    // 至少含 listFields label
    expect(csv.split('\n')[0]).toContain('姓名');
  });
});

describe('parseFile 真文件', () => {
  function makeCsvFile(content: string, name = '测试.csv'): File {
    return new File([content], name, { type: 'text/csv' });
  }
  function makeXlsxFile(aoa: unknown[][], name = '测试.xlsx'): File {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new File([out], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  it('csv 真文件：中文表头 + 公式注入过滤', async () => {
    // 仅 = 和 @ 在导入时清洗，+ - | % 保留原值仅在 exportToCSV 阶段清洗，避免 +86/-2 等正常数据被误破坏
    const csv = '编号,姓名,赛道,备注\n1,张三,+123,|cat /etc/passwd\n2,李四,@SUM,正常\n3,王五,+86-13800000000,-2';
    const file = makeCsvFile(csv, '中文表头.csv');
    const apps = await parseFile(file, baseConfig);
    expect(apps.length).toBe(3);
    expect(apps[0].raw['编号']).toBe('1');
    expect(apps[0].raw['姓名']).toBe('张三');
    // +86 / |cat 等不应在导入时被前缀 "'"，仅 = @ 需前缀
    expect(apps[0].raw['赛道']).toBe("+123");
    expect(apps[0].raw['备注']).toBe("|cat /etc/passwd");
    expect(apps[1].raw['赛道']).toBe("'@SUM");
    // +86 手机前缀不应被误清洗
    expect(apps[2].raw['赛道']).toBe("+86-13800000000");
    expect(apps[2].raw['备注']).toBe("-2");
  });

  it('xlsx 真文件：中文表头 + 公式注入过滤（动态生成 buffer）', async () => {
    const aoa = [
      ['编号', '姓名', '赛道', '备注'],
      ['1', '张三', 'AI', '=HYPERLINK("http://evil","click")'],
      ['2', '李四', '@SUM(A1:A10)', '正常'],
      ['3', '王五', '-2+3', '|cat /etc/passwd'],
      ['4', '赵六', '+86-13800000000', '正常2'],
    ];
    const file = makeXlsxFile(aoa, '中文表头.xlsx');
    const apps = await parseFile(file, baseConfig);
    expect(apps.length).toBe(4);
    expect(apps[0].raw['备注']).toBe("'=HYPERLINK(\"http://evil\",\"click\")");
    expect(apps[1].raw['赛道']).toBe("'@SUM(A1:A10)");
    // + - | % 在导入阶段不清洗，保留原值
    expect(apps[2].raw['赛道']).toBe("-2+3");
    expect(apps[2].raw['备注']).toBe("|cat /etc/passwd");
    expect(apps[3].raw['赛道']).toBe("+86-13800000000");
    // 中文表头应原样保留
    expect(Object.keys(apps[0].raw)).toContain('姓名');
  });

  it('边界：重复表头抛错', async () => {
    const aoa = [
      ['姓名', '姓名', '邮箱'],
      ['张三', '张三2', 'a@b.com'],
    ];
    const file = makeXlsxFile(aoa, '重复表头.xlsx');
    await expect(parseFile(file, baseConfig)).rejects.toThrow(/表头重复/);
  });

  it('边界：空表头（空白/重复空表头抛错，单空表头可解析）', async () => {
    // 单空表头（一个空字符串列）应可解析，不抛错
    const aoaSingleEmpty = [
      ['姓名', '', '邮箱'],
      ['张三', 'x', 'a@b.com'],
    ];
    const fileSingle = makeXlsxFile(aoaSingleEmpty, '单空表头.xlsx');
    const apps = await parseFile(fileSingle, baseConfig);
    expect(apps.length).toBe(1);
    expect(Object.keys(apps[0].raw)).toContain('');
    // 双空表头应触发重复校验
    const aoaDupEmpty = [
      ['姓名', '', ''],
      ['张三', 'x', 'y'],
    ];
    const fileDup = makeXlsxFile(aoaDupEmpty, '重复空表头.xlsx');
    await expect(parseFile(fileDup, baseConfig)).rejects.toThrow(/表头重复/);

    // csv 空表头同样重复校验
    void '姓名,,邮箱\n张三,x,a@b.com\n';
    // 手动构造两空列： header "姓名,,邮箱" -> headers ["姓名","","邮箱"] 单空不重
    // 再构造 "姓名,,\n" -> ["姓名","",""] 双空重复
    const csvDup = '姓名,,\n张三,x,y\n';
    const fileCsvDup = makeCsvFile(csvDup, 'csv重复空表头.csv');
    await expect(parseFile(fileCsvDup, baseConfig)).rejects.toThrow(/表头重复/);
  });

  it('边界：空表行与无数据返回 []', async () => {
    const aoaEmpty = [['姓名', '邮箱']];
    const file = makeXlsxFile(aoaEmpty, '空数据.xlsx');
    const apps = await parseFile(file, baseConfig);
    expect(apps).toEqual([]);
  });

  it('边界：原型污染键 __proto__ 被过滤', async () => {
    const aoa = [
      ['__proto__', '姓名', '邮箱'],
      ['polluted', '张三', 'a@b.com'],
    ];
    const file = makeXlsxFile(aoa, '原型污染.xlsx');
    const apps = await parseFile(file, baseConfig);
    expect(apps.length).toBe(1);
    expect(apps[0].raw['__proto__']).toBeUndefined();
    expect(apps[0].raw['姓名']).toBe('张三');
  });
});
