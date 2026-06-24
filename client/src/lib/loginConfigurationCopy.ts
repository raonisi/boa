export type LoginConfigurationReason = "missing" | "invalid";

export const LOGIN_CONFIG_MISSING_TITLE =
  "Google 로그인 설정을 확인할 수 없습니다";

export const LOGIN_CONFIG_MISSING_DESCRIPTION =
  "현재 Google 로그인을 사용할 수 없습니다. 관리자에게 로그인 설정 확인을 요청해 주세요.";

export const LOGIN_CONFIG_INVALID_TITLE =
  "Google 로그인을 진행하지 못했습니다";

export const LOGIN_CONFIG_INVALID_DESCRIPTION =
  "연결 상태를 확인한 뒤 다시 시도해 주세요.";

export function getLoginConfigurationNotice(reason: LoginConfigurationReason) {
  if (reason === "invalid") {
    return {
      title: LOGIN_CONFIG_INVALID_TITLE,
      description: LOGIN_CONFIG_INVALID_DESCRIPTION,
    };
  }

  return {
    title: LOGIN_CONFIG_MISSING_TITLE,
    description: LOGIN_CONFIG_MISSING_DESCRIPTION,
  };
}

export function getBrandedLoginConfigMessage(
  reason: LoginConfigurationReason
): string {
  return getLoginConfigurationNotice(reason).description;
}
