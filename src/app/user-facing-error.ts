const errorMessages: Record<string, string> = {
  activity_phase_inactive: '当前不在开放阶段，请留意活动时间。',
  daily_limit: '今天的投票次数已用完，请明天再来。',
  duplicate_work: '请不要重复提交同一件作品。',
  final_vote_not_recorded: '投票暂未记录，请稍后重试。',
  identity_assertion_invalid: '账号身份校验失败，请刷新页面后重试。',
  identity_assertion_missing: '请在 B 站 Toy 页面内登录后再操作。',
  identity_assertion_rejected: '账号身份校验未通过，请重新登录 B 站后重试。',
  identity_verifier_unconfigured: '账号登录服务暂不可用，请稍后再试。',
  invalid_content_length: '请求内容无效，请重新选择文件后重试。',
  invalid_final_vote: '投票信息无效，请刷新页面后重试。',
  invalid_media_id: '作品文件信息无效，请重新选择并上传。',
  invalid_media_signature: '文件校验失败，请重新选择文件后再试。',
  invalid_pairing_vote: '二选一信息已失效，请重新获取作品。',
  invalid_submission: '投稿信息不完整或格式不正确，请检查后重试。',
  invalid_track: '请选择有效的投稿赛道。',
  media_file_required: '请先选择要上传的图片或视频。',
  media_not_owned: '作品文件与当前账号不匹配，请重新选择并上传。',
  media_required: '请先添加作品文件。',
  media_requirement_not_met: '当前赛道的文件数量或类型不符合要求。',
  media_too_large: '文件大小超出限制，请压缩后再上传。',
  operator_endpoint_unavailable: '运营后台接口尚未部署到服务器，请先更新 ECS 后端。',
  operator_login_failed: '后台密码不正确，请检查后重试。',
  operator_required: '当前账号没有运营后台权限。',
  operator_session_required: '后台登录已过期，请重新登录。',
  ops_auth_unconfigured: '运营后台尚未完成安全配置，请联系管理员。',
  pairing_assignment_invalid: '这组二选一已失效，请重新获取作品。',
  pairing_limit: '本赛道的盲选票数已用完。',
  rate_limit_exceeded: '操作太频繁，请稍后再试。',
  request_failed: '网络请求失败，请检查网络后重试。',
  request_too_large: '上传内容过大，请缩小文件后重试。',
  submission_limit: '你在这个赛道的投稿数量已达上限。',
  unsupported_media_type: '当前赛道不支持这种文件类型。'
};

export function userFacingError(reason: unknown, fallback: string): string {
  const code = reason instanceof Error ? reason.message : '';
  return errorMessages[code] ?? fallback;
}
