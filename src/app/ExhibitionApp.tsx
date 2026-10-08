import { Avatar, Button, ConfigProvider, Image } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { exhibitionManifest } from '../config/exhibition';
import type { ExhibitionManifest, ExhibitionWork } from '../types/exhibition';
import { useScrollReveal } from './use-scroll-reveal';
import './styles.css';
import './exhibition.css';

const localAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

function WorkExhibit({ work, index }: { work: ExhibitionWork; index: number }) {
  const [cover, ...remaining] = work.media;
  const imageMedia = work.media.filter((media) => media.kind === 'image');
  return (
    <article aria-labelledby={`work-title-${work.id}`} className="exhibition-work" data-motion-reveal="" id={`work-${work.id}`}>
      <header className="exhibition-work-heading">
        <span className="exhibition-number">0{index + 1}</span>
        <div><p>衣锦还裳 · 服装设计</p><h2 id={`work-title-${work.id}`}>{work.title}</h2></div>
        <div className="exhibition-author"><Avatar alt={`${work.authorName}的头像`} size={44} src={localAsset(work.avatar.path)} /><div><small>创作者</small><strong>{work.authorName}</strong></div></div>
      </header>
      <p className="exhibition-media-note">共 {work.media.length} 张作品图 · 点击图片查看完整原图，可左右切换</p>
      <Image.PreviewGroup items={imageMedia.map((media) => localAsset(media.path))}>
        {cover ? <div className="exhibition-cover">{cover.kind === 'image'
          ? <Image alt={`${work.title} · 第 1 张作品图`} src={localAsset(cover.preview?.path ?? cover.path)} preview={{ src: localAsset(cover.path) }} loading="lazy" />
          : <video aria-label={`${work.title}的作品视频`} controls preload="metadata" src={localAsset(cover.path)} />}</div> : null}
        {remaining.length > 0 ? <div className="exhibition-media-grid">{remaining.map((media, mediaIndex) => <figure data-motion-delay={String((mediaIndex % 3) * 70)} data-motion-reveal="" key={media.id}>
          {media.kind === 'image' ? <Image alt={`${work.title} · 第 ${mediaIndex + 2} 张作品图`} loading="lazy" preview={{ src: localAsset(media.path) }} src={localAsset(media.preview?.path ?? media.path)} /> : <video aria-label={`${work.title}的第 ${mediaIndex + 2} 个作品视频`} controls preload="metadata" src={localAsset(media.path)} />}
          <figcaption>作品图 {String(mediaIndex + 2).padStart(2, '0')}</figcaption>
        </figure>)}</div> : null}
      </Image.PreviewGroup>
    </article>
  );
}

export function ExhibitionApp({ manifest = exhibitionManifest }: { manifest?: ExhibitionManifest }) {
  const { rootRef, motionReady } = useScrollReveal(manifest);
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#cb8d48', borderRadius: 10, fontFamily: '"Noto Serif SC", "Songti SC", serif' } }}>
      <main className={`site-shell exhibition-shell${motionReady ? ' motion-ready' : ''}`} ref={rootRef}>
        <section className="hero exhibition-hero" id="home">
          <header className="site-header"><a aria-label="返回作品展首页" className="brand" href="#home"><i />鸣潮 · AI 二创作品展</a><nav aria-label="活动导航"><a href="#exhibition">作品展览</a><a href="#about">活动说明</a></nav></header>
          <div className="hero-ink" />
          <div className="hero-content">
            <div className="hero-kicker"><strong>鸣潮小站 × AI 创作小站联合举办</strong><span>Bilibili Toy 小站活动</span></div>
            <h1>衣锦还裳，<br />拉海洛新韵。</h1>
            <p className="hero-themes"><strong>衣锦还裳</strong> · 拉海洛国风换装秀</p>
            <p className="hero-date">投稿已结束 · 本期作品展示</p>
            <p className="exhibition-intro">感谢每一份灵感，让国风与拉海洛在此相遇。<br />留下作品，继续欣赏创作的光。</p>
            <div className="hero-actions"><Button href="#exhibition" icon={<ArrowRightOutlined />} size="large" type="primary">欣赏作品</Button><Button href="#about" size="large">查看活动说明</Button></div>
          </div>
          <img alt="雨巷中的国风角色插画" className="hero-art" src={localAsset('assets/rainy-wuwa-hero.png')} />
          <div aria-hidden="true" className="hero-bottom-fade" />
          <div className="exhibition-summary"><span>{String(manifest.works.length).padStart(2, '0')} <small>件作品</small></span><span>{manifest.works.reduce((total, work) => total + work.media.length, 0)} <small>张创作图</small></span><span><small>完整展示 · 保留原图</small></span></div>
        </section>

        <section className="content-section exhibition-section" id="exhibition">
          <div className="section-heading" data-motion-reveal=""><p>本期创作</p><h2>把灵感留在这场雨里</h2><p className="exhibition-section-copy">两份国风新装，两种创作表达。点击任意图片，细看完整设计。</p></div>
          <nav aria-label="作品目录" className="exhibition-index">{manifest.works.map((work, index) => <a href={`#work-${work.id}`} key={work.id}><span>0{index + 1}</span>{work.title}<ArrowRightOutlined /></a>)}</nav>
          {manifest.works.map((work, index) => <WorkExhibit index={index} key={work.id} work={work} />)}
        </section>

        <section className="content-section exhibition-about" data-motion-reveal="" id="about">
          <div className="section-heading"><p>感谢参与</p><h2>让创作的故事继续</h2></div>
          <div className="exhibition-about-card"><p>本期「衣锦还裳」拉海洛国风换装秀投稿已结束，现以作品展览的形式收尾，不再开展盲选与公开投票。</p><p>本活动由 bilibili 鸣潮小站与 AI 创作小站联合举办，属于小站二创活动，非鸣潮官方活动。展示作品的署名与权利归原作者及相关权利人所有，请勿擅自转载、冒用署名或用于商业用途。</p><p>二创作品中禁止丑化、拉踩角色等不当行为；如对作品展示、署名或相关权益有疑问，请联系主办小站。</p></div>
        </section>
        <footer>鸣潮小站 × AI 创作小站联合活动 · Bilibili Toy 小站活动，非鸣潮官方活动</footer>
      </main>
    </ConfigProvider>
  );
}
