import { useMemo, useState } from 'react';
import { Alert, Avatar, Button, Card, ConfigProvider, Empty, Input, Select, Statistic, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PublicActivityClient, type OperationsHttpClient } from '../adapters/http/public-activity-client';
import type { ActivitySettings, ContestWorkStatus, OperatorSubmission } from '../types/contest';
import './styles.css';

export type OperationsApi = OperationsHttpClient;

interface OpsAppProps {
  api?: OperationsApi;
}

const statusLabel: Record<ContestWorkStatus, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '盲选池',
  finalist: '已入围',
  hidden: '已隐藏'
};

const phaseOptions = [
  { value: 'submission', label: '投稿阶段' },
  { value: 'pairing', label: '盲选阶段' },
  { value: 'final-vote', label: '投票阶段' },
  { value: 'closed', label: '已结束' }
];

function StatusControl({ item, onChange }: { item: OperatorSubmission; onChange: (status: ContestWorkStatus) => void }) {
  return <Select aria-label={`${item.title}的展示状态`} onChange={onChange} options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))} size="small" value={item.status} />;
}

function DisplayControl({ item, onChange }: { item: OperatorSubmission; onChange: (isDisplayed: boolean) => void }) {
  return <Switch aria-label={`展示 ${item.title}`} checked={item.isDisplayed} disabled={item.status !== 'finalist'} onChange={onChange} size="small" />;
}

function WorkMediaPreview({ item }: { item: OperatorSubmission }) {
  const media = item.media[0];
  if (!media) return <span className="ops-media-empty">无媒体</span>;
  if (media.kind === 'video') return <video aria-label={`${item.title}的作品预览`} className="ops-media-preview" controls preload="metadata" src={media.url} />;
  return <img alt={`${item.title}的作品预览`} className="ops-media-preview" loading="lazy" src={media.url} />;
}

function stageTimestamp(settings: ActivitySettings, stage: keyof ActivitySettings['schedule'], edge: 'startAt' | 'endAt'): string {
  return settings.schedule[stage][edge] ?? '';
}

export function OpsApp({ api }: OpsAppProps) {
  const client = useMemo(() => api ?? new PublicActivityClient(), [api]);
  const [submissions, setSubmissions] = useState<OperatorSubmission[]>([]);
  const [settings, setSettings] = useState<ActivitySettings>();
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleOperationError(reason: unknown) {
    const message = reason instanceof Error ? reason.message : '运营操作失败';
    if (message === 'operator_session_required') {
      client.clearOperationsSession();
      setAuthorized(false);
      setSubmissions([]);
      setSettings(undefined);
      setPassword('');
    }
    setError(message);
  }

  async function enterOperations() {
    if (!password) {
      setError('请输入运营后台密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await client.loginOperations(password);
      const [records, activitySettings] = await Promise.all([client.listSubmissions(), client.getActivitySettings()]);
      setSubmissions(records);
      setSettings(activitySettings);
      setAuthorized(true);
      setPassword('');
    } catch (reason: unknown) {
      handleOperationError(reason);
    } finally {
      setLoading(false);
    }
  }

  function leaveOperations() {
    client.clearOperationsSession();
    setAuthorized(false);
    setSubmissions([]);
    setSettings(undefined);
    setPassword('');
    setError('');
  }

  async function updateStatus(item: OperatorSubmission, status: ContestWorkStatus, isDisplayed = item.isDisplayed) {
    const displayed = status === 'finalist' && isDisplayed;
    try {
      await client.setSubmissionStatus(item.id, status, displayed);
      setSubmissions((current) => current.map((record) => record.id === item.id ? { ...record, status, isDisplayed: displayed } : record));
    } catch (reason) {
      handleOperationError(reason);
    }
  }

  function updateSchedule(stage: keyof ActivitySettings['schedule'], edge: 'startAt' | 'endAt', value: string) {
    setSettings((current) => current ? { ...current, schedule: { ...current.schedule, [stage]: { ...current.schedule[stage], [edge]: value || undefined } } } : current);
  }

  async function saveActivitySettings() {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const saved = await client.saveActivitySettings(settings);
      setSettings(saved);
    } catch (reason) {
      handleOperationError(reason);
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnsType<OperatorSubmission> = [
    { title: '作品预览', key: 'media', width: 130, render: (_, item) => <WorkMediaPreview item={item} /> },
    { title: '作品 / 作者', key: 'work', render: (_, item) => <div className="ops-author"><Avatar src={item.authorAvatar || undefined}>{item.authorName.slice(0, 1)}</Avatar><span><strong>{item.title}</strong><small>{item.authorName}</small></span></div> },
    { title: '赛道', dataIndex: 'trackId', width: 250, render: (trackId) => <Tag color="gold">{trackId === 'resonance-style' ? '共鸣小剧场｜最佳画风奖' : trackId === 'resonance-story' ? '共鸣小剧场｜最佳剧情奖' : trackId === 'wardrobe-design' ? '衣锦还裳｜最佳服装设计奖' : '衣锦还裳｜最佳走秀视频奖'}</Tag> },
    { title: '盲选胜场', dataIndex: 'pairingWins', width: 110 },
    { title: '盲选曝光', dataIndex: 'exposureCount', width: 110 },
    { title: '投票阶段票数', dataIndex: 'finalVotes', width: 130 },
    { title: '入围状态', key: 'status', width: 145, render: (_, item) => <StatusControl item={item} onChange={(status) => void updateStatus(item, status)} /> },
    { title: '公开展示', key: 'display', width: 110, render: (_, item) => <DisplayControl item={item} onChange={(isDisplayed) => void updateStatus(item, item.status, isDisplayed)} /> }
  ];

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#8a5c34', borderRadius: 10, fontFamily: '"Noto Serif SC", "Songti SC", serif' } }}>
      <main className="ops-shell"><header className="ops-header"><div><p>受保护入口</p><h1>运营工作台</h1></div>{authorized ? <div className="ops-header-actions"><Tag color="success">密码验证通过</Tag><Button onClick={leaveOperations} size="small">退出后台</Button></div> : null}</header>
        {error ? <Alert message="无法完成运营操作" description={error} showIcon type="error" /> : null}
        {!authorized ? <Card className="ops-login-card" title="后台密码登录"><p>请输入运营后台密码。该密码只用于审核作品和活动设置，不影响公开页面的投稿与投票。</p><Input.Password aria-label="运营后台密码" onChange={(event) => setPassword(event.target.value)} onPressEnter={() => void enterOperations()} placeholder="输入运营后台密码" value={password} /><Button className="ops-login-button" loading={loading} onClick={() => void enterOperations()} type="primary">登录后台</Button></Card> : null}
        {authorized ? <>
          {settings ? <Card className="ops-settings" title="活动流程与对外时间"><div className="ops-settings-controls"><label>当前公开阶段<Select aria-label="当前公开阶段" onChange={(phase) => setSettings((current) => current ? { ...current, phase } : current)} options={phaseOptions} value={settings.phase} /></label><label className="preview-switch">测试预览<Switch aria-label="测试预览" checked={settings.previewMode} onChange={(previewMode) => setSettings((current) => current ? { ...current, previewMode } : current)} /><small>开启后，公开端同时显示投稿、盲选和投票流程。</small></label></div>
            <div className="ops-schedule-grid">{(Object.keys(settings.schedule) as Array<keyof ActivitySettings['schedule']>).map((stage) => <div key={stage}><strong>{settings.schedule[stage].label}</strong><Input aria-label={`${settings.schedule[stage].label}开始时间`} onChange={(event) => updateSchedule(stage, 'startAt', event.target.value)} placeholder="2026-08-20T00:00:00+08:00" value={stageTimestamp(settings, stage, 'startAt')} /><Input aria-label={`${settings.schedule[stage].label}结束时间`} onChange={(event) => updateSchedule(stage, 'endAt', event.target.value)} placeholder="2026-09-02T23:59:59+08:00" value={stageTimestamp(settings, stage, 'endAt')} /></div>)}</div>
            <Button loading={saving} onClick={() => void saveActivitySettings()} type="primary">保存活动流程</Button></Card> : null}
          <section className="ops-stats"><Statistic title="提交总数" value={submissions.length} /><Statistic title="待审核" value={submissions.filter((item) => item.status === 'pending').length} /><Statistic title="已入围" value={submissions.filter((item) => item.status === 'finalist').length} /></section>
          {submissions.length ? <Table columns={columns} dataSource={submissions} pagination={{ pageSize: 10 }} rowKey="id" scroll={{ x: 760 }} /> : <Empty description="暂时没有投稿记录" />}
        </> : null}
      </main>
    </ConfigProvider>
  );
}
