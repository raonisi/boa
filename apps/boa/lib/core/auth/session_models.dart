enum BoaRole { branchAdmin, subBranchAdmin, teamLeader, member }

extension BoaRoleX on BoaRole {
  bool get isAdmin => this == BoaRole.branchAdmin;
  bool get isManager =>
      this == BoaRole.branchAdmin ||
      this == BoaRole.subBranchAdmin ||
      this == BoaRole.teamLeader;
}

/// OAuth 연동 전까지 플레이스홀더. 서버 `users` 응답과 매핑 예정.
class SessionUser {
  const SessionUser({
    required this.id,
    required this.name,
    required this.role,
    this.accountStatus = 'active',
  });

  final int id;
  final String name;
  final BoaRole role;
  final String accountStatus;

  bool get isActive => accountStatus == 'active';
}
