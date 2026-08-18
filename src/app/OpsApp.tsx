import { useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, ConfigProvider, Empty, Select, Spin, Statistic, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PublicActivityClient, type OperationsHttpClient } from '../adapters/http/public-activity-client';
import type { ContestWorkStatus, OperatorSubmission } from '../types/contest';
import './styles.css';

export type OperationsApi = OperationsHttpClient;

interface OpsAppProps {
  api?: OperationsApi;
}

const statusLabel: Record<ContestWorkStatus, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '初选池',
  finalist: '已入围',
  hidden: '已隐藏'
};

function StatusControl({ item, onChange }: { item: OperatorSubmission; onChange: (status: ContestWorkStatus) => void }) {
  return <Select aria-label={`${item.title}的展示状态`} onChange={onChange} options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))} size="small" value={item.status} />;
}

function DisplayControl({ item, onChange }: { item: OperatorSubmission; onChange: (isDisplayed: boolean) => void }) {
  return <Switch aria-label={`展示 ${item.title}`} checked={item.isDisplayed} disabled={item.status !== 'finalist'} onChange={onChange} size="small" />;
}

export function OpsApp({ api }: OpsAppProps) {
  const client = useMemo(() => api ?? new PublicActivityClient(), [api]);
  const [submissions, setSubmissions] = useState<OperatorSubmission[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([client.currentViewer(), client.listSubmissions()])
      .then(([, records]) => {
        if (!live) return;
        setSubmissions(records);
        setAuthorized(true);
      })
      .catch((reason: unknown) => {
        if (live) setError(reason instanceof Error ? reason.message : '白名单验证失败');
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [client]);

  async function updateStatus(item: OperatorSubmission, status: ContestWorkStatus, isDisplayed = item.isDisplayed) {
    const displayed = status === 'finalist' && isDisplayed;
    try {
      await client.setSubmissionStatus(item.id, status, displayed);
      setSubmissions((current) => current.map((record) => record.id === item.id ? { ...record, status, isDisplayed: displayed } : record));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '更新状态失败');
    }
  }

  const columns: ColumnsType<OperatorSubmission> = [
    {
      title: '作品 / 作者',
      key: 'work',
      render: (_, item) => <div className="ops-author"><Avatar src={item.authorAvatar || undefined}>{item.authorName.slice(0, 1)}</Avatar><span><strong>{item.title}</strong><small>{item.authorName}</small></span></div>
    },
    { title: '赛道', dataIndex: 'trackId', width: 150, render: (trackId) => <Tag color="gold">{trackId === 'resonance-theatre' ? '共鸣小剧场' : '衣锦还裳'}</Tag> },
    { title: '初选胜场', dataIndex: 'pairingWins', width: 110 },
    { title: '初选曝光', dataIndex: 'exposureCount', width: 110 },
    { title: '决赛票数', dataIndex: 'finalVotes', width: 110 },
    { title: '入围状态', key: 'status', width: 145, render: (_, item) => <StatusControl item={item} onChange={(status) => void updateStatus(item, status)} /> },
    { title: '公开展示', key: 'display', width: 110, render: (_, item) => <DisplayControl item={item} onChange={(isDisplayed) => void updateStatus(item, item.status, isDisplayed)} /> }
  ];

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#8a5c34', borderRadius: 10, fontFamily: '"Noto Serif SC", "Songti SC", serif' } }}>
      <main className="ops-shell">
        <header className="ops-header"><div><p>受保护入口</p><h1>运营工作台</h1></div>{authorized ? <Tag color="success">白名单验证通过</Tag> : null}</header>
        {loading ? <Spin className="ops-loading" size="large" /> : null}
        {error ? <Alert message="无法访问运营数据" description={error} showIcon type="error" /> : null}
        {!loading && authorized ? <>
          <section className="ops-stats"><Statistic title="提交总数" value={submissions.length} /><Statistic title="待审核" value={submissions.filter((item) => item.status === 'pending').length} /><Statistic title="已入围" value={submissions.filter((item) => item.status === 'finalist').length} /></section>
          {submissions.length ? <Table columns={columns} dataSource={submissions} pagination={{ pageSize: 10 }} rowKey="id" scroll={{ x: 760 }} /> : <Empty description="暂时没有投稿记录" />}
        </> : null}
      </main>
    </ConfigProvider>
  );
}
