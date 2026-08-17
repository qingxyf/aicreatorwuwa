import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  ConfigProvider,
  Drawer,
  Empty,
  Form,
  Input,
  Progress,
  Tag,
  message
} from 'antd';
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  CloudUploadOutlined,
  HeartFilled,
  PictureOutlined,
} from '@ant-design/icons';
import { PublicActivityClient, type ActivityHttpClient } from '../adapters/http/public-activity-client';
import { defaultContestPhase, trackDefinitions } from '../config/activity';
import type { ClientSubmissionInput, PublicContestConfig, PublicGalleryWork, PublicPairingWork, PublicTrack } from '../types/contest';
import './styles.css';

export type PublicActivityApi = ActivityHttpClient;

interface AppProps {
  api?: PublicActivityApi;
}

interface SubmissionFormValues {
  title: string;
  characterName?: string;
  aiTool?: string;
  description?: string;
}

const fallbackConfig: PublicContestConfig = {
  phase: defaultContestPhase,
  tracks: trackDefinitions
};

const countdownLabels = ['投稿期 14 天', '初选 7 天', '决赛 7 天'];

function currentArtUrl() {
  return `${import.meta.env.BASE_URL}assets/rainy-wuwa-hero.png`;
}

function mediaRequirementMessage(track: PublicTrack, files: File[]): string | null {
  const hasValidVideo = track.videoSatisfiesMinimum && files.some((file) => file.type.startsWith('video/'));
  const imageCount = files.filter((file) => file.type.startsWith('image/')).length;
  if (hasValidVideo || imageCount >= track.minimumMediaCount) return null;
  return track.videoSatisfiesMinimum
    ? `本赛道需要至少 ${track.minimumMediaCount} 张图片，或 1 个视频`
    : `本赛道需要至少 ${track.minimumMediaCount} 张图片`;
}

function MediaArtwork({ media, title, compact = false }: { media: PublicGalleryWork['media']; title: string; compact?: boolean }) {
  const feature = media[0];
  if (!feature) {
    return <div className="media-empty"><PictureOutlined />作品预览</div>;
  }
  if (feature.kind === 'video') {
    return <video className={compact ? 'media-art compact' : 'media-art'} src={feature.url} controls preload="metadata" aria-label={`${title}的视频预览`} />;
  }
  return <img className={compact ? 'media-art compact' : 'media-art'} src={feature.url} alt={`${title}的作品预览`} />;
}

function TrackTabs({ tracks, activeTrackId, onChange }: { tracks: PublicTrack[]; activeTrackId: string; onChange: (trackId: ClientSubmissionInput['trackId']) => void }) {
  return (
    <div className="track-tabs" role="tablist" aria-label="活动赛道">
      {tracks.map((track, index) => (
        <button
          aria-selected={track.id === activeTrackId}
          className={track.id === activeTrackId ? 'track-tab active' : 'track-tab'}
          key={track.id}
          onClick={() => onChange(track.id)}
          role="tab"
          type="button"
        >
          <span>0{index + 1}</span>{track.title}
        </button>
      ))}
    </div>
  );
}

function RulePanel({ track }: { track: PublicTrack }) {
  return (
    <Card className="rule-card" variant="borderless">
      <div className="rule-card-head">
        <div>
          <p>当前赛道</p>
          <h3>{track.title}</h3>
        </div>
        <Tag bordered={false} color="gold">每账号限投 1 件</Tag>
      </div>
      <p className="rule-summary">{track.summary}</p>
      <ul>
        {track.requirements.map((requirement) => <li key={requirement}><CheckCircleFilled />{requirement}</li>)}
      </ul>
    </Card>
  );
}

function PairingCard({ work, onSelect }: { work: PublicPairingWork; onSelect: () => void }) {
  return (
    <button className="pairing-work" onClick={onSelect} type="button">
      <MediaArtwork media={work.media} title={work.title} compact />
      <span>{work.title}</span>
      <strong>选这一件 <ArrowRightOutlined /></strong>
    </button>
  );
}

function GalleryCard({ work, voted, onVote }: { work: PublicGalleryWork; voted: boolean; onVote: () => void }) {
  return (
    <article className="gallery-card">
      <MediaArtwork media={work.media} title={work.title} />
      <div className="gallery-content">
        <div className="gallery-meta">
          <Avatar alt={`${work.authorName}的头像`} size={28} src={work.authorAvatar}>{work.authorName.slice(0, 1)}</Avatar>
          <span>{work.authorName}</span>
          <em>{work.finalVotes} 票</em>
        </div>
        <h4>{work.title}</h4>
        <Button aria-label={`投票给 ${work.title}`} block className={voted ? 'voted-button' : ''} icon={voted ? <CheckCircleFilled /> : <HeartFilled />} onClick={onVote} type={voted ? 'default' : 'primary'}>
          {voted ? '今日已投' : '投给这件作品'}
        </Button>
      </div>
    </article>
  );
}

export function App({ api }: AppProps) {
  const client = useMemo(() => api ?? new PublicActivityClient(), [api]);
  const [, messageContext] = message.useMessage();
  const [form] = Form.useForm<SubmissionFormValues>();
  const [config, setConfig] = useState<PublicContestConfig>(fallbackConfig);
  const [activeTrackId, setActiveTrackId] = useState<ClientSubmissionInput['trackId']>('resonance-theatre');
  const [gallery, setGallery] = useState<PublicGalleryWork[]>([]);
  const [pair, setPair] = useState<PublicPairingWork[]>([]);
  const [pairingAssignmentId, setPairingAssignmentId] = useState<string>();
  const [pairRemaining, setPairRemaining] = useState(3);
  const [votedWorkIds, setVotedWorkIds] = useState<Set<string>>(() => new Set());
  const [finalVotesRemaining, setFinalVotesRemaining] = useState(3);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submissionNotice, setSubmissionNotice] = useState('');
  const [voteNotice, setVoteNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const activeTrack = config.tracks.find((track) => track.id === activeTrackId) ?? config.tracks[0];

  useEffect(() => {
    let live = true;
    client.loadConfig()
      .then((nextConfig) => {
        if (!live) return;
        setConfig(nextConfig);
        if (!nextConfig.tracks.some((track) => track.id === activeTrackId)) setActiveTrackId(nextConfig.tracks[0]?.id ?? 'resonance-theatre');
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [activeTrackId, client]);

  useEffect(() => {
    let live = true;
    client.listGallery(activeTrackId)
      .then((works) => { if (live) setGallery(works); })
      .catch(() => { if (live) setGallery([]); });
    return () => { live = false; };
  }, [activeTrackId, client]);

  function selectTrack(trackId: ClientSubmissionInput['trackId']) {
    setActiveTrackId(trackId);
    setPair([]);
    setPairingAssignmentId(undefined);
    setPairRemaining(3);
    setFinalVotesRemaining(3);
    setVotedWorkIds(new Set());
    setVoteNotice('');
  }

  async function submitWork(values: SubmissionFormValues) {
    if (selectedFiles.length === 0) {
      setSubmissionNotice('请先添加至少一个图片或视频文件');
      return;
    }
    const mediaNotice = mediaRequirementMessage(activeTrack, selectedFiles);
    if (mediaNotice) {
      setSubmissionNotice(mediaNotice);
      return;
    }
    setIsSubmitting(true);
    setSubmissionNotice('');
    try {
      await client.currentViewer();
      const media = await Promise.all(selectedFiles.map((file) => client.uploadMedia(file)));
      await client.submit({
        trackId: activeTrack.id,
        title: values.title.trim(),
        characterName: values.characterName?.trim(),
        aiTool: values.aiTool?.trim(),
        description: values.description?.trim(),
        mediaIds: media.map((item) => item.id)
      });
      setSubmissionNotice('投稿已保存，等待审核');
      setSelectedFiles([]);
      form.resetFields();
    } catch (error) {
      setSubmissionNotice(error instanceof Error ? error.message : '投稿暂时失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestPair() {
    setIsPairing(true);
    setVoteNotice('');
    try {
      const nextPair = await client.nextPair(activeTrack.id);
      setPair(nextPair?.works ?? []);
      setPairingAssignmentId(nextPair?.assignmentId);
      if (!nextPair || nextPair.works.length < 2) setVoteNotice('本赛道暂时没有足够作品可供二选一，请稍后再来。');
    } catch (error) {
      setVoteNotice(error instanceof Error ? error.message : '请在 B站 Toy 内登录后参与投票');
    } finally {
      setIsPairing(false);
    }
  }

  async function choosePair(workId: string) {
    if (pair.length !== 2 || !pairingAssignmentId) return;
    try {
      await client.castPairingVote({ trackId: activeTrack.id, assignmentId: pairingAssignmentId, preferredWorkId: workId });
      setPairRemaining((current) => Math.max(0, current - 1));
      setPair([]);
      setPairingAssignmentId(undefined);
      setVoteNotice('本次选择已记录。');
    } catch (error) {
      setVoteNotice(error instanceof Error ? error.message : '选择未能保存，请重试');
    }
  }

  async function voteForFinalist(work: PublicGalleryWork) {
    if (votedWorkIds.has(work.id)) {
      setVoteNotice('同一作品当天只能投一次');
      return;
    }
    if (finalVotesRemaining <= 0) {
      setVoteNotice('今日本赛道的 3 票已用完');
      return;
    }
    setIsVoting(true);
    setVoteNotice('');
    try {
      const result = await client.castFinalVote({ trackId: activeTrack.id, workId: work.id });
      setVotedWorkIds((current) => new Set(current).add(work.id));
      setFinalVotesRemaining(result.remainingAfter);
      setGallery((current) => current.map((item) => item.id === work.id ? { ...item, finalVotes: item.finalVotes + 1 } : item));
    } catch (error) {
      setVoteNotice(error instanceof Error ? error.message : '投票未能保存，请重试');
    } finally {
      setIsVoting(false);
    }
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#cb8d48', borderRadius: 10, fontFamily: '"Noto Serif SC", "Songti SC", serif' } }}>
      {messageContext}
      <main className="site-shell">
        <section className="hero" id="rules">
          <header className="site-header">
            <a className="brand" href="#rules" aria-label="返回活动首页"><i />鸣潮 · 创作征集</a>
            <nav aria-label="活动导航">
              <a href="#rules">活动规则</a>
              <a href="#submit" onClick={(event) => { event.preventDefault(); setSubmissionOpen(true); }}>我要投稿</a>
              <a href="#vote">参与投票</a>
            </nav>
          </header>
          <div className="hero-ink" />
          <div className="hero-content">
            <h1>雨落拉海洛，<br />共鸣成新章。</h1>
            <p className="hero-date">投稿 14 天 · 两阶段投票 14 天 · 结果公示随后开启</p>
            <div className="hero-actions">
              <Button icon={<CloudUploadOutlined />} onClick={() => setSubmissionOpen(true)} size="large" type="primary">开始投稿</Button>
              <Button href="#vote" size="large">先看投票规则 <ArrowRightOutlined /></Button>
            </div>
          </div>
          <img className="hero-art" src={currentArtUrl()} alt="雨巷中的国风角色插画" />
          <div className="hero-stage" aria-label="活动周期">
            {countdownLabels.map((label, index) => <span key={label}><b>0{index + 1}</b>{label}</span>)}
          </div>
        </section>

        <section className="content-section rules-section">
          <div className="section-heading"><p>参与之前</p><h2>一次看懂活动规则</h2></div>
          <TrackTabs activeTrackId={activeTrack.id} onChange={selectTrack} tracks={config.tracks} />
          <RulePanel track={activeTrack} />
          <div className="vote-rules">
            <article><span>第一阶段</span><h3>初选：每赛道 3 次二选一</h3><p>两件作品中选出更喜欢的一件。系统优先派发出现次数更少的作品，让每件作品获得大致均衡的展示机会。</p></article>
            <article><span>第二阶段</span><h3>决赛：每日每赛道 3 票</h3><p>入围作品公开展示作者头像、昵称与实时票数；同一作品当天只能投一次。</p></article>
          </div>
        </section>

        <section className="content-section participation-section" id="submit">
          <div className="section-heading"><p>上传作品</p><h2>把你的灵感留在这场雨里</h2></div>
          <Card className="submit-callout" variant="borderless">
            <div><h3>{activeTrack.title}</h3><p>每个账号在本赛道只能提交 1 件作品。登录后即可上传图片或视频，审核通过后进入投票池。</p></div>
            <Button icon={<CloudUploadOutlined />} onClick={() => setSubmissionOpen(true)} type="primary">填写投稿信息</Button>
          </Card>
        </section>

        <section className="content-section vote-section" id="vote">
          <div className="section-heading"><p>参与选择</p><h2>你的每一次选择都很重要</h2></div>
          <TrackTabs activeTrackId={activeTrack.id} onChange={selectTrack} tracks={config.tracks} />
          <div className="pairing-panel">
            <div className="pairing-head"><div><span>第一阶段 · 二选一</span><h3>让作品公平地相遇</h3></div><Progress percent={(pairRemaining / 3) * 100} showInfo={false} strokeColor="#cb8d48" trailColor="rgba(203,141,72,.16)" /></div>
            <p>本赛道还可进行 {pairRemaining} 次选择</p>
            {pair.length === 2 ? (
              <div className="pairing-grid"><PairingCard work={pair[0]} onSelect={() => void choosePair(pair[0].id)} /><div className="versus">VS</div><PairingCard work={pair[1]} onSelect={() => void choosePair(pair[1].id)} /></div>
            ) : <Button disabled={pairRemaining === 0} loading={isPairing} onClick={() => void requestPair()} size="large" type="primary">开始二选一</Button>}
          </div>

          <div className="gallery-heading"><div><span>第二阶段 · 入围展示</span><h3>为喜欢的作品投票</h3></div><p>每个赛道每日 3 票 · 还可投 {finalVotesRemaining} 票</p></div>
          {voteNotice ? <Alert className="vote-notice" message={voteNotice} showIcon type={voteNotice.includes('已记录') ? 'success' : 'info'} /> : null}
          {gallery.length > 0 ? <div className="gallery-grid">{gallery.map((work) => <GalleryCard key={work.id} onVote={() => void voteForFinalist(work)} voted={votedWorkIds.has(work.id) || isVoting} work={work} />)}</div> : <Empty className="gallery-empty" description="入围作品将在第二阶段开放展示" />}
        </section>

        <footer>鸣潮 AI 二创主题征集 · 原创内容与社区规范共同守护</footer>

        <Drawer className="submission-drawer" destroyOnClose={false} onClose={() => setSubmissionOpen(false)} open={submissionOpen} title="提交你的作品" width={520}>
          <p className="drawer-intro">当前赛道：<strong>{activeTrack.title}</strong>。提交前请确认作品为原创 AI 二创内容。</p>
          <Form form={form} layout="vertical" onFinish={(values) => void submitWork(values)} requiredMark={false}>
            <Form.Item label="作品标题" name="title" rules={[{ required: true, message: '请填写作品标题' }]}><Input maxLength={40} placeholder="给作品取一个名字" /></Form.Item>
            <Form.Item label="角色名称" name="characterName"><Input maxLength={40} placeholder="例如：椿、今汐……" /></Form.Item>
            <Form.Item label="使用的 AI 工具" name="aiTool"><Input maxLength={60} placeholder="例如：绘图、视频或剪辑工具" /></Form.Item>
            <Form.Item label="创作说明" name="description"><Input.TextArea maxLength={500} placeholder="说说你的创作思路" rows={4} showCount /></Form.Item>
            <div className="file-picker"><label htmlFor="media-input">作品文件</label><input accept={activeTrack.acceptedMedia.map((kind) => kind === 'image' ? 'image/*' : 'video/*').join(',')} aria-label="添加作品文件" id="media-input" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))} type="file" /><p>{selectedFiles.length ? `已选择 ${selectedFiles.length} 个文件：${selectedFiles.map((file) => file.name).join('、')}` : '支持 JPG、PNG、WebP、MP4 和 WebM。'}</p></div>
            {submissionNotice ? <Alert className="submission-notice" message={submissionNotice} showIcon type={submissionNotice === '投稿已保存，等待审核' ? 'success' : 'warning'} /> : null}
            <Button aria-label="提交作品" block htmlType="submit" icon={<CloudUploadOutlined />} loading={isSubmitting} size="large" type="primary">提交作品</Button>
          </Form>
        </Drawer>
      </main>
    </ConfigProvider>
  );
}
