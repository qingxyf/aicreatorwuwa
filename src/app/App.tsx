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
  Modal,
  Progress,
  Radio,
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
import { defaultActivitySettings, trackDefinitions } from '../config/activity';
import { createDemoPreviewData, demoPreviewConfig } from '../config/demo-preview';
import { isPublicPhaseVisible } from '../domain/activity-phase';
import type { ContestPhase, ContestTrackId, PublicContestConfig, PublicGalleryWork, PublicPairingWork, PublicTrack } from '../types/contest';
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
  ...defaultActivitySettings,
  schedule: {
    submission: { ...defaultActivitySettings.schedule.submission },
    pairing: { ...defaultActivitySettings.schedule.pairing },
    finalVote: { ...defaultActivitySettings.schedule.finalVote }
  },
  tracks: trackDefinitions
};

const stageOrder: Array<{ phase: Exclude<ContestPhase, 'closed'>; scheduleKey: 'submission' | 'pairing' | 'finalVote'; number: string }> = [
  { phase: 'submission', scheduleKey: 'submission', number: '01' },
  { phase: 'pairing', scheduleKey: 'pairing', number: '02' },
  { phase: 'final-vote', scheduleKey: 'finalVote', number: '03' }
];

const localDemoData = createDemoPreviewData(import.meta.env.BASE_URL);

function currentArtUrl() {
  return `${import.meta.env.BASE_URL}assets/rainy-wuwa-hero.png`;
}

function characterArtUrl(filename: string) {
  return `${import.meta.env.BASE_URL}assets/${filename}`;
}

function formatSchedule(startAt?: string, endAt?: string): string {
  if (!startAt || !endAt) return '时间待运营发布';
  const formatter = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' });
  return `${formatter.format(new Date(startAt))} — ${formatter.format(new Date(endAt))}`;
}

function mediaRequirementMessage(track: PublicTrack, files: File[]): string | null {
  const hasValidVideo = track.videoSatisfiesMinimum && files.some((file) => file.type.startsWith('video/'));
  const imageCount = files.filter((file) => file.type.startsWith('image/')).length;
  if (hasValidVideo || imageCount >= track.minimumMediaCount) return null;
  return track.videoSatisfiesMinimum
    ? `本赛道需要至少 ${track.minimumMediaCount} 张图片，或 1 个视频`
    : `本赛道需要至少 ${track.minimumMediaCount} 张图片`;
}

function detectedMediaType(files: File[]): string {
  if (files.length === 0) return '';
  const kinds = new Set(files.map((file) => file.type.startsWith('video/') ? '视频' : file.type.startsWith('image/') ? '图片' : '未知文件'));
  return `已识别为${[...kinds].join('、')}`;
}

function acceptedMediaText(track: PublicTrack): string {
  if (track.acceptedMedia.length === 1) return '仅支持图片：JPG、PNG、WebP（单张不超过 20MB）';
  return '支持图片 JPG、PNG、WebP（单张不超过 20MB）或视频 MP4、WebM（单个不超过 100MB）';
}

function MediaArtwork({ media, title, compact = false }: { media: PublicGalleryWork['media']; title: string; compact?: boolean }) {
  const feature = media[0];
  if (!feature) return <div className="media-empty"><PictureOutlined />作品预览</div>;
  if (feature.kind === 'video') return <video className={compact ? 'media-art compact' : 'media-art'} src={feature.url} controls preload="metadata" aria-label={`${title}的视频预览`} />;
  return <img className={compact ? 'media-art compact' : 'media-art'} src={feature.url} alt={`${title}的作品预览`} />;
}

function TrackTabs({ tracks, activeTrackId, onChange }: { tracks: PublicTrack[]; activeTrackId: ContestTrackId; onChange: (trackId: ContestTrackId) => void }) {
  return (
    <div className="track-tabs" role="tablist" aria-label="活动赛道">
      {tracks.map((track, index) => (
        <button aria-selected={track.id === activeTrackId} className={track.id === activeTrackId ? 'track-tab active' : 'track-tab'} key={track.id} onClick={() => onChange(track.id)} role="tab" type="button">
          <span>0{index + 1}</span>{track.title}
        </button>
      ))}
    </div>
  );
}

function RulePanel({ track }: { track: PublicTrack }) {
  return (
    <Card className="rule-card" variant="borderless">
      <div className="rule-card-head"><div><p>当前赛道</p><h3>{track.title}</h3></div><Tag bordered={false} color="gold">每账号限提交 1 件</Tag></div>
      <p className="rule-summary">{track.summary}</p>
      <ul>{track.requirements.map((requirement) => <li key={requirement}><CheckCircleFilled />{requirement}</li>)}</ul>
    </Card>
  );
}

function CharacterDuo() {
  return (
    <div aria-hidden="true" className="character-duo">
      <img className="character-companion character-companion-blonde" decoding="async" loading="lazy" src={characterArtUrl('blonde-character-soft-smile.png')} alt="" />
      <img className="character-companion character-companion-grey" decoding="async" loading="lazy" src={characterArtUrl('grey-character-soft-smile.png')} alt="" />
    </div>
  );
}

function PairingCard({ work, onSelect }: { work: PublicPairingWork; onSelect: () => void }) {
  return <button className="pairing-work" onClick={onSelect} type="button"><MediaArtwork media={work.media} title={work.title} compact /><span>{work.title}</span><strong>选这一件 <ArrowRightOutlined /></strong></button>;
}

function GalleryCard({ work, voted, onVote }: { work: PublicGalleryWork; voted: boolean; onVote: () => void }) {
  return (
    <article className="gallery-card">
      <MediaArtwork media={work.media} title={work.title} />
      <div className="gallery-content"><div className="gallery-meta"><Avatar alt={`${work.authorName}的头像`} size={28} src={work.authorAvatar}>{work.authorName.slice(0, 1)}</Avatar><span>{work.authorName}</span><em>{work.finalVotes} 票</em></div><h4>{work.title}</h4>
        <Button aria-label={`投票给 ${work.title}`} block className={voted ? 'voted-button' : ''} icon={voted ? <CheckCircleFilled /> : <HeartFilled />} onClick={onVote} type={voted ? 'default' : 'primary'}>{voted ? '今日已投' : '投给这件作品'}</Button>
      </div>
    </article>
  );
}

function CompleteRules({ config }: { config: PublicContestConfig }) {
  return (
    <div className="complete-rules">
      <section><h3>活动与赛道</h3><p>活动包含「鸣潮·共鸣小剧场」与「鸣潮·衣锦还裳」两个赛道。每个账号每个赛道最多提交 1 件作品，两个赛道可同时参与。</p></section>
      <section><h3>三阶段与时间</h3><ul>{stageOrder.map((stage) => <li key={stage.phase}><strong>{config.schedule[stage.scheduleKey].label}</strong><span>{formatSchedule(config.schedule[stage.scheduleKey].startAt, config.schedule[stage.scheduleKey].endAt)}</span></li>)}</ul><p>以活动页公示的阶段与北京时间为准；未设置日期时，请等待运营发布。</p></section>
      <section><h3>投稿与内容规范</h3><p>作品须为原创 AI 二创内容，符合 B 站社区规范，不得盗用、搬运、发布 NSFW 或其他违规内容。允许适度调色、排版、剪辑及配乐，但参赛者须确保自己拥有投稿、展示所需的权利。</p><p>小剧场需提交至少 4 张图片；衣锦还裳需提交至少 3 张图片或 1 个视频。系统会校验文件类型、大小与实际文件签名。</p></section>
      <section><h3>投票规则</h3><p>盲选阶段，每个账号每赛道 3 票，每次从两件作品中选 1 件，系统以作品曝光均衡为目标派发对比。投票阶段，入围作品会展示作者昵称、头像和票数；每个账号每赛道每天 3 票，同一作品当天不得重复投票。</p></section>
      <section><h3>禁止刷票与破坏服务</h3><p>禁止使用脚本、外挂、批量账号、自动化请求、漏洞利用、伪造身份、篡改请求或其他非正当方式影响投稿、曝光或票数。禁止扫描、攻击、干扰、压测、破坏服务器、存储、数据库及其他活动服务。违反者将被取消资格、撤销票数或作品展示；情节严重的，主办方将保留追究责任的权利。</p></section>
      <section><h3>责任与处理说明</h3><p>参赛即表示同意主办方在活动展示、评审与公示范围内展示作品、昵称和头像。主办方可对违规、疑似侵权、异常投票或技术风险作品进行审核、隐藏、取消资格或调整展示；在法律允许范围内，活动解释、风控与处理决定以主办方最终公示为准。</p></section>
    </div>
  );
}

function ActivityRewards() {
  const rewardSlots = [
    { index: '01', title: '奖励信息即将公布', copy: '奖项名称与评选细则将在活动正式公告中更新。' },
    { index: '02', title: '奖励内容待揭晓', copy: '具体奖品、数量及发放方式以后续公告为准。' },
    { index: '03', title: '每一份创作都值得被看见', copy: '作品展示、入围与奖励资格以运营审核及最终公示为准。' }
  ];

  return (
    <section className="content-section rewards-section" id="rewards">
      <div className="section-heading"><p>活动回馈</p><h2>把灵感，留在这场雨里</h2></div>
      <p className="rewards-intro">本活动奖励正在筹备中，奖品信息会在后续公告中统一公布。</p>
      <div className="rewards-grid">
        {rewardSlots.map((slot) => <article key={slot.index} className="reward-slot"><span>{slot.index}</span><h3>{slot.title}</h3><p>{slot.copy}</p></article>)}
      </div>
    </section>
  );
}

export function App({ api }: AppProps) {
  const client = useMemo(() => api ?? new PublicActivityClient(), [api]);
  const [, messageContext] = message.useMessage();
  const [form] = Form.useForm<SubmissionFormValues>();
  const [config, setConfig] = useState<PublicContestConfig>(fallbackConfig);
  const [configReady, setConfigReady] = useState(false);
  const [configLoadFailed, setConfigLoadFailed] = useState(false);
  const [localPreview, setLocalPreview] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<ContestTrackId>('resonance-theatre');
  const [submissionTrackId, setSubmissionTrackId] = useState<ContestTrackId>('resonance-theatre');
  const [gallery, setGallery] = useState<PublicGalleryWork[]>([]);
  const [pair, setPair] = useState<PublicPairingWork[]>([]);
  const [pairingAssignmentId, setPairingAssignmentId] = useState<string>();
  const [pairRemaining, setPairRemaining] = useState(3);
  const [votedWorkIds, setVotedWorkIds] = useState<Set<string>>(() => new Set());
  const [finalVotesRemaining, setFinalVotesRemaining] = useState(3);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submissionNotice, setSubmissionNotice] = useState('');
  const [voteNotice, setVoteNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const activeTrack = config.tracks.find((track) => track.id === activeTrackId) ?? config.tracks[0];
  const submissionTrack = config.tracks.find((track) => track.id === submissionTrackId) ?? activeTrack;
  const isPublicInteractionReady = configReady && !configLoadFailed;
  const showSubmission = isPublicInteractionReady && isPublicPhaseVisible(config.phase, config.previewMode, 'submission');
  const showPairing = isPublicInteractionReady && isPublicPhaseVisible(config.phase, config.previewMode, 'pairing');
  const showFinalVote = isPublicInteractionReady && isPublicPhaseVisible(config.phase, config.previewMode, 'final-vote');

  useEffect(() => {
    let live = true;
    client.loadConfig().then((nextConfig) => {
      if (!live) return;
      setConfig(nextConfig);
      setLocalPreview(false);
      setConfigReady(true);
      setActiveTrackId((current) => nextConfig.tracks.some((track) => track.id === current) ? current : nextConfig.tracks[0]?.id ?? 'resonance-theatre');
      setSubmissionTrackId((current) => nextConfig.tracks.some((track) => track.id === current) ? current : nextConfig.tracks[0]?.id ?? 'resonance-theatre');
    }).catch(() => {
      if (!live) return;
      if (import.meta.env.DEV) {
        setConfig(demoPreviewConfig);
        setLocalPreview(true);
        setConfigReady(true);
        setConfigLoadFailed(false);
        return;
      }
      setConfigLoadFailed(true);
    });
    return () => { live = false; };
  }, [client]);

  useEffect(() => {
    let live = true;
    if (localPreview) {
      setGallery(localDemoData.galleryByTrack[activeTrackId] ?? []);
      return () => { live = false; };
    }
    client.listGallery(activeTrackId).then((works) => { if (live) setGallery(works); }).catch(() => { if (live) setGallery([]); });
    return () => { live = false; };
  }, [activeTrackId, client, localPreview]);

  function selectTrack(trackId: ContestTrackId) {
    setActiveTrackId(trackId);
    setPair([]);
    setPairingAssignmentId(undefined);
    setPairRemaining(3);
    setFinalVotesRemaining(3);
    setVotedWorkIds(new Set());
    setVoteNotice('');
  }

  function openSubmission(trackId = activeTrack.id) {
    setSubmissionTrackId(trackId);
    setSelectedFiles([]);
    setSubmissionNotice('');
    setSubmissionOpen(true);
  }

  function selectSubmissionTrack(trackId: ContestTrackId) {
    setSubmissionTrackId(trackId);
    setSelectedFiles([]);
    setSubmissionNotice('');
  }

  async function submitWork(values: SubmissionFormValues) {
    if (selectedFiles.length === 0) {
      setSubmissionNotice('请先添加至少一个图片或视频文件');
      return;
    }
    const mediaNotice = mediaRequirementMessage(submissionTrack, selectedFiles);
    if (mediaNotice) {
      setSubmissionNotice(mediaNotice);
      return;
    }
    setIsSubmitting(true);
    setSubmissionNotice('');
    try {
      if (localPreview) {
        setSubmissionNotice('投稿预览已保存（本地演示）');
        setSelectedFiles([]);
        form.resetFields();
        return;
      }
      await client.currentViewer();
      const media = await Promise.all(selectedFiles.map((file) => client.uploadMedia(file)));
      await client.submit({ trackId: submissionTrack.id, title: values.title.trim(), characterName: values.characterName?.trim(), aiTool: values.aiTool?.trim(), description: values.description?.trim(), mediaIds: media.map((item) => item.id) });
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
      if (localPreview) {
        const nextPair = localDemoData.pairingByTrack[activeTrack.id];
        setPair(nextPair.works);
        setPairingAssignmentId(nextPair.assignmentId);
        return;
      }
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
      if (localPreview) {
        setPairRemaining((current) => Math.max(0, current - 1));
        setPair([]);
        setPairingAssignmentId(undefined);
        setVoteNotice(`已选择「${pair.find((work) => work.id === workId)?.title ?? '作品'}」（本地演示）`);
        return;
      }
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
      if (localPreview) {
        setVotedWorkIds((current) => new Set(current).add(work.id));
        setFinalVotesRemaining((current) => Math.max(0, current - 1));
        setGallery((current) => current.map((item) => item.id === work.id ? { ...item, finalVotes: item.finalVotes + 1 } : item));
        setVoteNotice('本地演示投票已记录。');
        return;
      }
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

  const heroAction = !isPublicInteractionReady ? null : showSubmission
    ? <Button icon={<CloudUploadOutlined />} onClick={() => openSubmission()} size="large" type="primary">开始投稿</Button>
    : showPairing || showFinalVote ? <Button href="#vote" icon={<ArrowRightOutlined />} size="large" type="primary">参与投票</Button> : <Button onClick={() => setRulesOpen(true)} size="large" type="primary">查看活动规则</Button>;

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#cb8d48', borderRadius: 10, fontFamily: '"Noto Serif SC", "Songti SC", serif' } }}>
      {messageContext}
      <main className="site-shell">
        <section className="hero" id="rules">
          <header className="site-header"><a className="brand" href="#rules" aria-label="返回活动首页"><i />鸣潮 · 创作征集</a><nav aria-label="活动导航"><a href="#rules" onClick={(event) => { event.preventDefault(); setRulesOpen(true); }}>活动规则</a>{showSubmission ? <a href="#submit" onClick={(event) => { event.preventDefault(); openSubmission(); }}>我要投稿</a> : null}{showPairing || showFinalVote ? <a href="#vote">参与投票</a> : null}</nav></header>
          <div className="hero-ink" />
          <div className="hero-content"><div className="hero-kicker"><strong>鸣潮小站 × AI 创作小站联合举办</strong><span>Bilibili Toy 小站活动</span></div><h1>雨落拉海洛，<br />共鸣成新章。</h1><p className="hero-date">{!configReady ? '正在加载活动阶段与时间…' : configLoadFailed ? '活动配置暂不可用，请稍后重试' : <>当前开放：{config.phase === 'closed' ? '活动已结束' : stageOrder.find((stage) => stage.phase === config.phase)?.scheduleKey ? config.schedule[stageOrder.find((stage) => stage.phase === config.phase)!.scheduleKey].label : '活动状态待发布'} · {config.previewMode ? '运营预览模式：全阶段展示' : '仅展示当前活动阶段'}</>}</p><div className="hero-actions">{heroAction}<Button onClick={() => setRulesOpen(true)} size="large">查看完整规则 <ArrowRightOutlined /></Button></div></div>
          <img className="hero-art" src={currentArtUrl()} alt="雨巷中的国风角色插画" />
          <div className="hero-stage" aria-label="活动周期">{stageOrder.map((stage) => { const item = config.schedule[stage.scheduleKey]; const active = config.phase === stage.phase; return <span className={active ? 'active-stage' : ''} key={stage.phase}><b>{stage.number}</b><i><strong>{item.label}</strong><small>{formatSchedule(item.startAt, item.endAt)}</small></i></span>; })}</div>
        </section>

        <section className="content-section rules-section"><div className="section-heading"><p>参与之前</p><h2>选择赛道，再开始创作</h2></div><TrackTabs activeTrackId={activeTrack.id} onChange={selectTrack} tracks={config.tracks} /><RulePanel track={activeTrack} /><div className="vote-rules"><article><span>盲选阶段</span><h3>每个赛道 3 票</h3><p>每次从两件作品中选 1 件。系统优先安排曝光较少的作品，让每件作品获得更均衡的展示机会。</p></article><article><span>投票阶段</span><h3>每赛道每日 3 票</h3><p>入围作品公开展示作者头像、昵称与实时票数；同一作品当天只能投一次。</p></article></div><CharacterDuo /></section>

        {showSubmission ? <section className="content-section participation-section" id="submit"><div className="section-heading"><p>{config.schedule.submission.label}</p><h2>把你的灵感留在这场雨里</h2></div><Card className="submit-callout" variant="borderless"><div><h3>投稿时间</h3><p>{formatSchedule(config.schedule.submission.startAt, config.schedule.submission.endAt)}。选择赛道后上传图片或视频，审核通过后会进入后续活动阶段。</p></div><Button icon={<CloudUploadOutlined />} onClick={() => openSubmission()} type="primary">填写投稿信息</Button></Card></section> : null}

        {showPairing || showFinalVote ? <section className="content-section vote-section" id="vote"><div className="section-heading"><p>参与选择</p><h2>你的每一次选择都很重要</h2></div><TrackTabs activeTrackId={activeTrack.id} onChange={selectTrack} tracks={config.tracks} />
          {showPairing ? <div className="pairing-panel"><div className="pairing-head"><div><span>{config.schedule.pairing.label} · 每个赛道 3 票</span><h3>让作品公平地相遇</h3></div><Progress percent={(pairRemaining / 3) * 100} showInfo={false} strokeColor="#cb8d48" trailColor="rgba(203,141,72,.16)" /></div><p>{formatSchedule(config.schedule.pairing.startAt, config.schedule.pairing.endAt)} · 本赛道还可投 {pairRemaining} 票</p>{pair.length === 2 ? <div className="pairing-grid"><PairingCard work={pair[0]} onSelect={() => void choosePair(pair[0].id)} /><div className="versus">VS</div><PairingCard work={pair[1]} onSelect={() => void choosePair(pair[1].id)} /></div> : <Button disabled={pairRemaining === 0} loading={isPairing} onClick={() => void requestPair()} size="large" type="primary">开始盲选</Button>}</div> : null}
          {showFinalVote ? <><div className="gallery-heading"><div><span>{config.schedule.finalVote.label} · 入围展示</span><h3>为喜欢的作品投票</h3></div><p>{formatSchedule(config.schedule.finalVote.startAt, config.schedule.finalVote.endAt)} · 每个赛道每日 3 票 · 还可投 {finalVotesRemaining} 票</p></div>{voteNotice ? <Alert className="vote-notice" message={voteNotice} showIcon type={voteNotice.includes('已记录') ? 'success' : 'info'} /> : null}{gallery.length > 0 ? <div className="gallery-grid">{gallery.map((work) => <GalleryCard key={work.id} onVote={() => void voteForFinalist(work)} voted={votedWorkIds.has(work.id) || isVoting} work={work} />)}</div> : <Empty className="gallery-empty" description="入围作品将在投票阶段开放展示" />}</> : null}
        </section> : null}

        <ActivityRewards />

        <footer>鸣潮小站 × AI 创作小站联合活动 · Bilibili Toy 小站活动，非鸣潮官方活动 · 原创内容与社区规范共同守护</footer>

        <Modal className="rules-modal" footer={<Button key="close" onClick={() => setRulesOpen(false)} type="primary">我已了解</Button>} onCancel={() => setRulesOpen(false)} open={rulesOpen} title="活动完整规则"><CompleteRules config={config} /></Modal>

        <Drawer className="submission-drawer" destroyOnClose={false} onClose={() => setSubmissionOpen(false)} open={submissionOpen} title="提交你的作品" width={520}>
          <p className="drawer-intro">请选择投稿赛道与作品类型。提交前请确认作品为原创 AI 二创内容。</p>
          <Form form={form} layout="vertical" onFinish={(values) => void submitWork(values)} requiredMark={false}>
            <Form.Item label="投稿赛道"><Radio.Group aria-label="投稿赛道" onChange={(event) => selectSubmissionTrack(event.target.value as ContestTrackId)} value={submissionTrack.id}>{config.tracks.map((track) => <Radio key={track.id} value={track.id}>{track.title}</Radio>)}</Radio.Group></Form.Item>
            <p className="submission-track-status">当前投稿赛道：<strong>{submissionTrack.title}</strong></p>
            <Form.Item label="作品标题" name="title" rules={[{ required: true, message: '请填写作品标题' }]}><Input maxLength={40} placeholder="给作品取一个名字" /></Form.Item>
            <Form.Item label="角色名称" name="characterName"><Input maxLength={40} placeholder="例如：椿、今汐……" /></Form.Item>
            <Form.Item label="使用的 AI 工具" name="aiTool"><Input maxLength={60} placeholder="例如：绘图、视频或剪辑工具" /></Form.Item>
            <Form.Item label="创作说明" name="description"><Input.TextArea maxLength={500} placeholder="说说你的创作思路" rows={4} showCount /></Form.Item>
            <div className="file-picker"><label htmlFor="media-input">作品文件</label><p className="media-kind-hint">{acceptedMediaText(submissionTrack)}</p><input accept={submissionTrack.acceptedMedia.map((kind) => kind === 'image' ? 'image/*' : 'video/*').join(',')} aria-label="添加作品文件" id="media-input" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))} type="file" /><p>{selectedFiles.length ? `${detectedMediaType(selectedFiles)} · 已选择 ${selectedFiles.length} 个文件：${selectedFiles.map((file) => file.name).join('、')}` : `本赛道：${acceptedMediaText(submissionTrack)}`}</p></div>
            {submissionNotice ? <Alert className="submission-notice" message={submissionNotice} showIcon type={submissionNotice.includes('已保存') ? 'success' : 'warning'} /> : null}
            <Button aria-label="提交作品" block htmlType="submit" icon={<CloudUploadOutlined />} loading={isSubmitting} size="large" type="primary">提交作品</Button>
          </Form>
        </Drawer>
      </main>
    </ConfigProvider>
  );
}
