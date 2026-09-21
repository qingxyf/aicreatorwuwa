import { useMemo, useState } from 'react';
import { Alert, Avatar, Button, Card, ConfigProvider, Empty, Input, Modal, Select, Statistic, Switch, Table, Tag } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PublicActivityClient, type OperationsHttpClient } from '../adapters/http/public-activity-client';
import { defaultActivitySettings } from '../config/activity';
import type { ActivitySettings, ContestWorkStatus, OperatorOrphanMediaGroup, OperatorSubmission } from '../types/contest';
import { userFacingError } from './user-facing-error';
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
  { value: 'final-vote', label: '公开投票阶段' },
  { value: 'closed', label: '已结束' }
];

const schedulePlaceholders: Record<keyof ActivitySettings['schedule'], { startAt: string; endAt: string }> = {
  submission: { startAt: '2026-09-01T00:00:00+08:00', endAt: '2026-10-08T23:59:59+08:00' },
  pairing: { startAt: '2026-10-09T00:00:00+08:00', endAt: '2026-10-12T23:59:59+08:00' },
  finalVote: { startAt: '2026-10-13T00:00:00+08:00', endAt: '2026-10-18T23:59:59+08:00' },
  results: { startAt: '2026-10-19T00:00:00+08:00', endAt: '2026-10-21T23:59:59+08:00' }
};

function StatusControl({ item, onChange }: { item: OperatorSubmission; onChange: (status: ContestWorkStatus) => void }) {
  return <Select aria-label={`${item.title}的展示状态`} onChange={onChange} options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))} size="small" value={item.status} />;
}

function DisplayControl({ item, onChange }: { item: OperatorSubmission; onChange: (isDisplayed: boolean) => void }) {
  return <Switch aria-label={`展示 ${item.title}`} checked={item.isDisplayed} disabled={item.status !== 'finalist'} onChange={onChange} size="small" />;
}

type OpsMedia = OperatorSubmission['media'][number];
type GalleryTarget = { title: string; media: OpsMedia[] };

function WorkMediaPreview({ item, onOpen }: { item: OperatorSubmission; onOpen: (title: string, media: OpsMedia[]) => void }) {
  const media = item.media[0];
  if (!media) return <span className="ops-media-empty">无媒体</span>;
  return <button aria-label={`${item.title}的作品预览`} className="ops-media-preview-button" onClick={() => onOpen(item.title, item.media)} type="button">
    {media.kind === 'video' ? <video className="ops-media-preview" muted preload="metadata" src={media.url} /> : <img alt={`${item.title}的作品预览`} className="ops-media-preview" loading="lazy" src={media.url} />}
    {item.media.length > 1 ? <span className="ops-media-count">{item.media.length} 个媒体</span> : null}
  </button>;
}

function OrphanMediaPreview({ group, onOpen }: { group: OperatorOrphanMediaGroup; onOpen: (title: string, media: OpsMedia[]) => void }) {
  const media = group.media[0];
  if (!media) return <span className="ops-media-empty">无媒体</span>;
  return <button aria-label={`孤立媒体 ${group.id} 的预览`} className="ops-media-preview-button" onClick={() => onOpen(group.title || '未完成投稿', group.media)} type="button">
    {media.kind === 'video' ? <video className="ops-media-preview" muted preload="metadata" src={media.url} /> : <img alt={`孤立媒体 ${group.id} 的预览`} className="ops-media-preview" loading="lazy" src={media.url} />}
    <span className="ops-media-count">{group.media.length} 个媒体</span>
  </button>;
}

function MediaGalleryModal({ target, index, onClose, onIndexChange }: { target: GalleryTarget | null; index: number; onClose: () => void; onIndexChange: (index: number) => void }) {
  if (!target) return null;
  const active = target.media[index] ?? target.media[0];
  const activeIndex = target.media.indexOf(active);
  return <Modal aria-label={`${target.title}的全部媒体`} className="ops-media-modal" footer={null} onCancel={onClose} open width="min(92vw, 960px)" title={target.title}>
    <div className="ops-gallery-viewer">
      <div className="ops-gallery-stage">
        {active.kind === 'video' ? <video aria-label={`${target.title}的第 ${activeIndex + 1} 张媒体`} controls autoPlay={false} className="ops-gallery-active-media" src={active.url} /> : <img alt={`${target.title}的第 ${activeIndex + 1} 张媒体`} className="ops-gallery-active-media" src={active.url} />}
      </div>
      <div className="ops-gallery-controls">
        <Button aria-label="上一张媒体" disabled={activeIndex <= 0} icon={<LeftOutlined />} onClick={() => onIndexChange(Math.max(0, activeIndex - 1))}>上一张</Button>
        <span>{activeIndex + 1} / {target.media.length}</span>
        <Button aria-label="下一张媒体" disabled={activeIndex >= target.media.length - 1} icon={<RightOutlined />} onClick={() => onIndexChange(Math.min(target.media.length - 1, activeIndex + 1))}>下一张</Button>
      </div>
      <div className="ops-gallery-thumbnails" aria-label="全部媒体缩略图">
        {target.media.map((media, mediaIndex) => <button aria-label={`查看第 ${mediaIndex + 1} 张媒体`} className={mediaIndex === activeIndex ? 'active' : ''} key={media.id} onClick={() => onIndexChange(mediaIndex)} type="button">
          {media.kind === 'video' ? <video muted preload="metadata" src={media.url} /> : <img alt="" src={media.url} />}
        </button>)}
      </div>
    </div>
  </Modal>;
}

function trackLabel(trackId: string | undefined): string {
  if (trackId === 'resonance-style') return '共鸣小剧场｜最佳画风奖';
  if (trackId === 'resonance-story') return '共鸣小剧场｜最佳剧情奖';
  if (trackId === 'wardrobe-design') return '衣锦还裳｜最佳服装设计奖';
  if (trackId === 'wardrobe-video') return '衣锦还裳｜最佳走秀视频奖';
  return '未记录赛道';
}

function orphanReasonLabel(group: OperatorOrphanMediaGroup): string {
  if (group.status === 'historical') return '历史上传，未找到投稿记录';
  if (group.failureReason === 'submission_limit') return '重复投稿限制';
  if (group.failureReason === 'media_requirement_not_met') return '媒体数量或类型不符合要求';
  if (group.failureReason === 'media_not_owned') return '媒体归属校验失败';
  if (group.failureReason === 'activity_phase_inactive') return '投稿阶段已关闭';
  return group.status === 'uploading' ? '上传后尚未完成投稿' : '投稿提交失败';
}

function stageTimestamp(settings: ActivitySettings, stage: keyof ActivitySettings['schedule'], edge: 'startAt' | 'endAt'): string {
  return settings.schedule[stage][edge] ?? '';
}

export function OpsApp({ api }: OpsAppProps) {
  const client = useMemo(() => api ?? new PublicActivityClient(), [api]);
  const [submissions, setSubmissions] = useState<OperatorSubmission[]>([]);
  const [orphanMedia, setOrphanMedia] = useState<OperatorOrphanMediaGroup[]>([]);
  const [settings, setSettings] = useState<ActivitySettings>();
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [galleryTarget, setGalleryTarget] = useState<GalleryTarget | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  function handleOperationError(reason: unknown) {
    const code = reason instanceof Error ? reason.message : '';
    if (code === 'operator_session_required') {
      client.clearOperationsSession();
      setAuthorized(false);
      setSubmissions([]);
      setOrphanMedia([]);
      setSettings(undefined);
      setPassword('');
    }
    setError(userFacingError(reason, '运营操作失败，请稍后重试。'));
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
      const loadOrphanMedia = async (): Promise<OperatorOrphanMediaGroup[]> => {
        if (!client.listOrphanMedia) return [];
        try {
          return await client.listOrphanMedia();
        } catch (reason) {
          if (reason instanceof Error && reason.message === 'operator_endpoint_unavailable') return [];
          throw reason;
        }
      };
      const [records, activitySettings, orphanRecords] = await Promise.all([
        client.listSubmissions(),
        client.getActivitySettings(),
        loadOrphanMedia()
      ]);
      setSubmissions(records);
      setOrphanMedia(orphanRecords);
      setSettings({ ...activitySettings, schedule: { ...defaultActivitySettings.schedule, ...activitySettings.schedule } });
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
    setOrphanMedia([]);
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

  function openGallery(title: string, media: OpsMedia[]) {
    setGalleryTarget({ title, media });
    setGalleryIndex(0);
  }

  const columns: ColumnsType<OperatorSubmission> = [
    { title: '作品预览', key: 'media', width: 130, render: (_, item) => <WorkMediaPreview item={item} onOpen={openGallery} /> },
    { title: '作品 / 作者', key: 'work', render: (_, item) => <div className="ops-author"><Avatar src={item.authorAvatar || undefined}>{item.authorName.slice(0, 1)}</Avatar><span><strong>{item.title}</strong><small>{item.authorName}</small></span></div> },
    { title: '赛道', dataIndex: 'trackId', width: 250, render: (trackId) => <Tag color="gold">{trackLabel(trackId)}</Tag> },
    { title: '盲选胜场', dataIndex: 'pairingWins', width: 110 },
    { title: '盲选曝光', dataIndex: 'exposureCount', width: 110 },
    { title: '投票阶段票数', dataIndex: 'finalVotes', width: 130 },
    { title: '入围状态', key: 'status', width: 145, render: (_, item) => <StatusControl item={item} onChange={(status) => void updateStatus(item, status)} /> },
    { title: '公开展示', key: 'display', width: 110, render: (_, item) => <DisplayControl item={item} onChange={(isDisplayed) => void updateStatus(item, item.status, isDisplayed)} /> }
  ];

  const orphanColumns: ColumnsType<OperatorOrphanMediaGroup> = [
    { title: '媒体预览', key: 'media', width: 130, render: (_, group) => <OrphanMediaPreview group={group} onOpen={openGallery} /> },
    { title: '上传人', key: 'owner', width: 260, render: (_, group) => <div className="ops-orphan-owner"><strong>{group.authorName || '未记录昵称'}</strong><small>{group.ownerId}</small></div> },
    { title: '资料', key: 'context', width: 240, render: (_, group) => <div className="ops-orphan-context"><span>{group.title || '未保存投稿标题'}</span><small>{trackLabel(group.trackId)}</small></div> },
    { title: '上传时间', key: 'time', width: 190, render: (_, group) => <span>{new Date(group.firstUploadedAt).toLocaleString('zh-CN')}</span> },
    { title: '原因', key: 'reason', render: (_, group) => <Tag color="orange">{orphanReasonLabel(group)}</Tag> }
  ];

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#8a5c34', borderRadius: 10, fontFamily: '"Noto Serif SC", "Songti SC", serif' } }}>
      <main className="ops-shell"><header className="ops-header"><div><p>受保护入口</p><h1>运营工作台</h1></div>{authorized ? <div className="ops-header-actions"><Tag color="success">密码验证通过</Tag><Button onClick={leaveOperations} size="small">退出后台</Button></div> : null}</header>
        {error ? <Alert message="无法完成运营操作" description={error} showIcon type="error" /> : null}
        {!authorized ? <Card className="ops-login-card" title="后台密码登录"><p>请输入运营后台密码。该密码只用于审核作品和活动设置，不影响公开页面的投稿与投票。</p><Input.Password aria-label="运营后台密码" onChange={(event) => setPassword(event.target.value)} onPressEnter={() => void enterOperations()} placeholder="输入运营后台密码" value={password} /><Button className="ops-login-button" loading={loading} onClick={() => void enterOperations()} type="primary">登录后台</Button></Card> : null}
        {authorized ? <>
          {settings ? <Card className="ops-settings" title="活动流程与对外时间"><div className="ops-settings-controls"><label>当前公开阶段<Select aria-label="当前公开阶段" onChange={(phase) => setSettings((current) => current ? { ...current, phase } : current)} options={phaseOptions} value={settings.phase} /></label><label className="preview-switch">测试预览<Switch aria-label="测试预览" checked={settings.previewMode} onChange={(previewMode) => setSettings((current) => current ? { ...current, previewMode } : current)} /><small>开启后，公开端同时显示投稿、盲选和投票流程。</small></label></div>
            <div className="ops-schedule-grid">{(Object.keys(settings.schedule) as Array<keyof ActivitySettings['schedule']>).map((stage) => <div key={stage}><strong>{settings.schedule[stage].label}</strong><Input aria-label={`${settings.schedule[stage].label}开始时间`} onChange={(event) => updateSchedule(stage, 'startAt', event.target.value)} placeholder={schedulePlaceholders[stage].startAt} value={stageTimestamp(settings, stage, 'startAt')} /><Input aria-label={`${settings.schedule[stage].label}结束时间`} onChange={(event) => updateSchedule(stage, 'endAt', event.target.value)} placeholder={schedulePlaceholders[stage].endAt} value={stageTimestamp(settings, stage, 'endAt')} /></div>)}</div>
            <Button loading={saving} onClick={() => void saveActivitySettings()} type="primary">保存活动流程</Button></Card> : null}
          <section className="ops-stats"><Statistic title="提交总数" value={submissions.length} /><Statistic title="待审核" value={submissions.filter((item) => item.status === 'pending').length} /><Statistic title="已入围" value={submissions.filter((item) => item.status === 'finalist').length} /><Statistic title="孤立媒体" value={orphanMedia.reduce((total, group) => total + group.media.length, 0)} /></section>
          {submissions.length ? <Table columns={columns} dataSource={submissions} pagination={{ pageSize: 10 }} rowKey="id" scroll={{ x: 760 }} /> : <Empty description="暂时没有投稿记录" />}
          {orphanMedia.length ? <section className="ops-orphan-section"><div className="ops-orphan-heading"><div><p>上传后没有生成正式投稿记录</p><h2>未完成投稿 / 孤立媒体</h2></div><Tag color="orange">{orphanMedia.length} 组 · {orphanMedia.reduce((total, group) => total + group.media.length, 0)} 个媒体</Tag></div><Table columns={orphanColumns} dataSource={orphanMedia} pagination={{ pageSize: 8 }} rowKey="id" scroll={{ x: 980 }} /></section> : null}
        </> : null}
        <MediaGalleryModal index={galleryIndex} onClose={() => setGalleryTarget(null)} onIndexChange={setGalleryIndex} target={galleryTarget} />
      </main>
    </ConfigProvider>
  );
}
