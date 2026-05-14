enum BoaRole { branchAdmin, subBranchAdmin, teamLeader, member }

BoaRole boaRoleFromServer(String? raw) {
  switch (raw) {
    case 'branch_admin':
      return BoaRole.branchAdmin;
    case 'sub_branch_admin':
      return BoaRole.subBranchAdmin;
    case 'team_leader':
      return BoaRole.teamLeader;
    case 'member':
      return BoaRole.member;
    default:
      return BoaRole.member;
  }
}

extension BoaRoleX on BoaRole {
  bool get isAdmin => this == BoaRole.branchAdmin;
  bool get isManager =>
      this == BoaRole.branchAdmin ||
      this == BoaRole.subBranchAdmin ||
      this == BoaRole.teamLeader;
}

/// 서버 `GET /api/mobile/auth/me` 및 로그인 응답의 `user` 객체와 맞춥니다.
class SessionUser {
  const SessionUser({
    required this.id,
    required this.name,
    this.email,
    required this.role,
    this.accountStatus = 'active',
  });

  final int id;
  final String name;
  final String? email;
  final BoaRole role;
  final String accountStatus;

  bool get isActive => accountStatus == 'active';

  factory SessionUser.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    return SessionUser(
      id: id is int ? id : int.tryParse('$id') ?? 0,
      name: (json['name'] as String?)?.trim().isNotEmpty == true ? (json['name'] as String).trim() : '사용자',
      email: json['email'] as String?,
      role: boaRoleFromServer(json['role'] as String?),
      accountStatus: (json['accountStatus'] as String?) ?? 'active',
    );
  }
}

/// 로컬에 저장되는 JWT와 화면에 쓰는 사용자 정보.
class SessionState {
  const SessionState({
    required this.sessionToken,
    required this.user,
  });

  final String sessionToken;
  final SessionUser user;
}
