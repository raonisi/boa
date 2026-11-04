#!/usr/bin/env python3
"""Read-only BOA sourcepack structural checks. Policy approval/behavior need separate evidence."""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path, PureWindowsPath
from urllib.parse import unquote, urlsplit
import yaml

VALIDATOR_VERSION = '1.2.0'
SKILL = '.agents/skills/boa-crm-full-build'
REQUIRED = ('source_id', 'title', 'source_type', 'canonical', 'topics', 'task_modes', 'read_when', 'exclusions', 'authority', 'revision', 'checked_on', 'status', 'supersedes', 'acceptance', 'eval_cases', 'review', 'reproduction')
MODES = {'PLAN', 'READ_ONLY_REVIEW', 'IMPLEMENT_WITHIN_AUTHORIZED_SCOPE', 'EXTERNAL_MUTATION'}
STATUSES = {'active', 'historical', 'superseded', 'unresolved'}

def raw_hash(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def fingerprint(files):
    payload = ''.join(f"{x['path']}\t{x['bytes']}\t{x['sha256']}\n" for x in sorted(files, key=lambda x: x['path']))
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()

def anchors(text):
    result, counts = set(), {}
    for heading in re.findall(r'^#{1,6}\s+(.+?)\s*#*$', text, re.M):
        heading = re.sub(r'[*_\x60]', '', heading).lower()
        slug = re.sub(r'[^\w\- ]', '', heading).replace(' ', '-')
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        result.add(slug if not count else f'{slug}-{count}')
    result.update(re.findall(r'<a\s+(?:id|name)=[\"\x27]([^\"\x27]+)', text))
    return result

def clause_ids(value, label, error):
    """Explicit stable IDs only; prose scope is display metadata, never inferred.

    Regression inputs live in ../evals/clause-fixtures.json. Missing identifiers
    are NOT_VERIFIED and reject the structural gate instead of a false PASS.
    """
    if not isinstance(value, list) or not value or any(not isinstance(x, str) or not re.fullmatch(r'[A-Z][A-Z0-9]*(?:[_.:-][A-Z0-9]+)*', x) for x in value):
        error('CLAUSE_UNVERIFIABLE', f'{label}: nonempty stable clause ID list required; linkage NOT_VERIFIED')
        return None
    if len(value) != len(set(value)):
        error('CLAUSE_ID_DUPLICATE', label)
        return None
    return set(value)

def validate(repo, manifest_path=None, evidence_path=None):
    errors, observations = [], []
    def error(code, detail):
        errors.append({'code': code, 'detail': str(detail)})
    def local(rel, base=None):
        if not isinstance(rel, str) or Path(rel).is_absolute() or PureWindowsPath(rel).is_absolute() or '\\' in rel:
            error('PATH_CLASSIFICATION', rel)
            return None
        p = ((base or repo) / rel).resolve()
        if not p.is_relative_to(repo):
            error('PATH_ESCAPE', rel)
            return None
        if not p.is_file():
            error('MISSING_FILE', rel)
            return None
        return p
    entry = local(SKILL + '/SKILL.md')
    if entry:
        text = entry.read_text(encoding='utf-8')
        m = re.match(r'^---\r?\n(.*?)\r?\n---(?:\r?\n|$)', text, re.S)
        if not m:
            error('YAML', 'No valid frontmatter')
        else:
            try:
                data = yaml.safe_load(m.group(1))
                if not isinstance(data, dict):
                    error('YAML', 'Frontmatter must be a mapping')
                else:
                    if set(data) - {'name', 'description', 'license', 'allowed-tools', 'metadata'}:
                        error('YAML_FIELDS', 'Unsupported frontmatter field')
                    if data.get('name') != 'boa-crm-full-build' or not isinstance(data.get('description'), str) or not data.get('description', '').strip():
                        error('METADATA', 'Required existing name/nonempty description')
                    observations.append({'discovery_metadata': data, 'path': SKILL + '/SKILL.md', 'host_discovery': 'requires actual host observation'})
            except yaml.YAMLError as exc:
                error('YAML', exc)
    reg_path = local(SKILL + '/references/source-register.json')
    if not reg_path:
        return errors, observations
    try:
        reg = json.loads(reg_path.read_text(encoding='utf-8'))
    except (ValueError, OSError) as exc:
        error('REGISTER_JSON', exc)
        return errors, observations
    if reg.get('schema_version') != 1 or reg.get('packaging') != 'repository_bound' or reg.get('path_base') != 'repository_root':
        error('REGISTER_SCHEMA', 'Expected v1 repository-bound register')
    sources = reg.get('sources', [])
    if not isinstance(sources, list):
        error('REGISTER_SCHEMA', 'sources must be list')
        return errors, observations
    ids, graph, local_sources = {}, {}, {}
    for s in sources:
        if not isinstance(s, dict) or any(k not in s for k in REQUIRED):
            error('SOURCE_SCHEMA', s)
            continue
        sid = s['source_id']
        if not isinstance(sid, str) or not sid or sid in ids:
            error('DUPLICATE_ID', sid)
            continue
        ids[sid] = s
        graph[sid] = []
        if s['status'] not in STATUSES or not isinstance(s['task_modes'], list) or not set(s['task_modes']).issubset(MODES) or not s['read_when']:
            error('SOURCE_ROUTING', sid)
        if s['source_type'] == 'historical_taskpack' and s['status'] == 'active':
            error('HISTORICAL_AS_ACTIVE', sid)
        c = s['canonical']
        if not isinstance(c, dict):
            error('SOURCE_LOCATION', sid)
            continue
        kind = c.get('kind')
        if kind == 'repository':
            p = local(c.get('path'))
            if p:
                local_sources[c['path']] = p
                d = s.get('digest')
                if d and (d.get('kind') != 'raw_sha256' or d.get('value') != raw_hash(p)):
                    error('DIGEST_DRIFT', sid)
        elif kind == 'url':
            if urlsplit(c.get('url', '')).scheme != 'https':
                error('SOURCE_URL', sid)
        elif kind == 'external_input':
            member = c.get('member', '')
            if not c.get('input_id') or not member or PureWindowsPath(member).is_absolute() or member.startswith('/') or '..' in Path(member).parts or not s.get('missing_input_action'):
                error('EXTERNAL_CLASSIFICATION', sid)
            d = s.get('digest', {})
            if d.get('kind') != 'raw_sha256' or not re.fullmatch(r'[a-f0-9]{64}', d.get('value', '')):
                error('EXTERNAL_DIGEST', sid)
            meta = s.get('origin_metadata')
            if meta and meta.get('classification') != 'provenance_only_not_execution_dependency':
                error('EXTERNAL_CLASSIFICATION', sid)
        else:
            error('SOURCE_LOCATION', sid)
    # Collect ALL scopes by source pair before selecting clause relations.
    # Source identity/schema failures invalidate linkage; unrelated file/policy
    # failures do not turn a successfully checked equality into NOT_VERIFIED.
    relation_pairs, clause_relations = {}, {}
    for sid, s in ids.items():
        replacements = s['supersedes']
        if not isinstance(replacements, list):
            error('REPLACEMENT_TARGET', f'{sid}: supersedes must be a list')
            continue
        for replace in replacements:
            target = replace.get('target') if isinstance(replace, dict) else None
            if not isinstance(target, str) or not target:
                error('REPLACEMENT_TARGET', f'{sid} -> {target}')
                continue
            relation_pairs.setdefault((sid, target), []).append(replace)
    for (sid, target), replacements in relation_pairs.items():
        unique = len(replacements) == 1
        if not unique:
            error('CLAUSE_RELATION_AMBIGUOUS', f'{sid} -> {target}: multiple supersedes relations across scopes')
        for replace in replacements:
            scope = replace.get('scope')
            if target not in ids or scope not in {'document', 'clauses'}:
                error('REPLACEMENT_TARGET', f'{sid} -> {target}')
                continue
            graph[sid].append(target)
            # An ambiguous pair has no selected winner, regardless of order.
            if unique and scope == 'clauses':
                if not replace.get('clauses'):
                    error('REPLACEMENT_SCOPE', sid)
                clause_relations[(sid, target)] = clause_ids(replace.get('clauses'), f'{sid} -> {target}', error)
    visiting, visited = set(), set()
    def visit(sid):
        if sid in visiting:
            error('REPLACEMENT_CYCLE', sid)
            return
        if sid in visited:
            return
        visiting.add(sid)
        for target in graph[sid]:
            visit(target)
        visiting.remove(sid)
        visited.add(sid)
    for sid in graph:
        visit(sid)
    overrides = reg.get('clause_overrides', [])
    if not isinstance(overrides, list):
        error('CLAUSE_UNVERIFIABLE', 'clause_overrides must be a list; linkage NOT_VERIFIED')
        overrides = []
    seen_overrides = set()
    for override in overrides:
        if not isinstance(override, dict):
            error('CLAUSE_UNVERIFIABLE', 'override must be an object; linkage NOT_VERIFIED')
            continue
        original, correction = override.get('original'), override.get('correction')
        if not isinstance(original, str) or not isinstance(correction, str):
            error('CLAUSE_RELATION', 'original/correction must be source IDs')
            continue
        pair = (correction, original)
        actual = clause_ids(override.get('clause_ids'), f'override {correction} -> {original}', error)
        if pair in seen_overrides:
            error('CLAUSE_RELATION_AMBIGUOUS', f'{correction} -> {original}: duplicate override')
        seen_overrides.add(pair)
        if original not in ids or correction not in ids or pair not in clause_relations:
            error('CLAUSE_RELATION', override)
        else:
            expected = clause_relations[pair]
            if expected is not None and actual is not None and expected != actual:
                error('CLAUSE_SCOPE_MISMATCH', f'{correction} -> {original}: missing={sorted(expected - actual)}, extra={sorted(actual - expected)}')
        if ids.get(original, {}).get('status') == 'active':
            error('RETIRED_CLAUSE_ACTIVE', original)
    for correction, original in clause_relations.keys() - seen_overrides:
        error('CLAUSE_RELATION', f'{correction} -> {original}: missing override')
    linkage_errors = {'SOURCE_SCHEMA', 'DUPLICATE_ID', 'REGISTER_SCHEMA',
                      'REPLACEMENT_TARGET', 'REPLACEMENT_SCOPE', 'REPLACEMENT_CYCLE'}
    linkage_verified = bool(clause_relations) and not any(
        x['code'].startswith('CLAUSE_') or x['code'] in linkage_errors for x in errors)
    observations.append({'clause_linkage': 'VERIFIED' if linkage_verified else 'NOT_VERIFIED',
                         'basis': 'existing unambiguous source IDs; unique supersedes pair across all scopes; exactly one matching override and valid duplicate-free stable clause ID sets checked for exact equality. Linkage only: unrelated file/policy validity and approval are separate gates; no equality checked means NOT_VERIFIED'})
    for conflict in reg.get('conflicts', []):
        fields = ('conflict_id', 'status', 'sources', 'confirmed', 'needed_evidence', 'restricted_actions', 'independent_work', 'owner_role', 'release_condition')
        if any(not conflict.get(k) for k in fields) or conflict.get('status') != 'unresolved':
            error('CONFLICT_SCHEMA', conflict)
        for source in conflict.get('sources', []):
            if source.get('source_id') not in ids or not source.get('excerpt') or not source.get('section'):
                error('CONFLICT_SOURCE', source)
    for redirect in reg.get('redirects', []):
        src, dst = local(redirect.get('path')), local(redirect.get('target'))
        if not src or not dst:
            continue
        if redirect.get('kind') == 'pointer':
            if redirect.get('executable') is not False or src.read_text(encoding='utf-8').startswith('---'):
                error('REDIRECT_EXECUTABLE', src)
            targets = re.findall(r'\[[^\]]+\]\(([^\s)]+)\)', src.read_text(encoding='utf-8'))
            if not any((src.parent / unquote(t.split('#')[0])).resolve() == dst for t in targets if not urlsplit(t).scheme):
                error('REDIRECT_TARGET', src)
        elif redirect.get('kind') == 'generated_copy':
            if src.read_bytes() != dst.read_bytes():
                error('COPY_DRIFT', src)
        else:
            error('REDIRECT_KIND', redirect)
    # Only skill Markdown links: domain manuals are conditional sources, not recursively audited.
    for p in sorted((repo / SKILL).rglob('*.md')):
        text = p.read_text(encoding='utf-8')
        for link in re.findall(r'\[[^\]]+\]\(([^\s)]+)\)', text):
            parsed = urlsplit(link)
            if parsed.scheme in {'https', 'http', 'mailto'}:
                continue
            if parsed.scheme:
                error('PATH_CLASSIFICATION', link)
                continue
            target = local(unquote(parsed.path), p.parent) if parsed.path else p
            if target and parsed.fragment and unquote(parsed.fragment) not in anchors(target.read_text(encoding='utf-8')):
                error('MISSING_ANCHOR', f'{p.relative_to(repo)} -> {link}')
    if manifest_path:
        try:
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            rows = manifest['files']
            paths = [x['path'] for x in rows]
            if len(paths) != len(set(paths)):
                error('MANIFEST_DUPLICATE', paths)
            for row in rows:
                p = local(row['path'])
                if p and (p.stat().st_size != row['bytes'] or raw_hash(p) != row['sha256']):
                    error('CANDIDATE_DRIFT', row['path'])
            required_paths = set(local_sources) | {str(p.relative_to(repo)).replace('\\', '/') for p in (repo / SKILL).rglob('*') if p.is_file()}
            for missing in sorted(required_paths - set(paths)):
                error('MANIFEST_MISSING_DEPENDENCY', missing)
            if fingerprint(rows) != manifest.get('content_set_sha256'):
                error('MANIFEST_FINGERPRINT', 'Declared content-set hash differs')
            if evidence_path:
                evidence = json.loads(evidence_path.read_text(encoding='utf-8'))
                if evidence.get('candidate_id') != manifest.get('candidate_id') or evidence.get('content_set_sha256') != manifest.get('content_set_sha256'):
                    error('STALE_EVIDENCE', 'Evidence belongs to a different candidate')
        except (KeyError, ValueError, OSError, TypeError) as exc:
            error('MANIFEST_SCHEMA', exc)
    elif evidence_path:
        error('EVIDENCE_WITHOUT_CANDIDATE', 'Use --manifest with --evidence')
    observations.append({'semantic_policy': 'not automatically judged', 'sources': len(ids), 'host_discovery': 'not certified by this tool'})
    return errors, observations

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', required=True, type=Path)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--evidence', type=Path)
    args = parser.parse_args()
    try:
        errors, observations = validate(args.repo.resolve(), args.manifest, args.evidence)
    except (OSError, TypeError, ValueError, KeyError) as exc:
        errors, observations = [{'code': 'INPUT_ERROR', 'detail': str(exc)}], []
    print(json.dumps({'schema_version': 1, 'validator_version': VALIDATOR_VERSION, 'static_structure': 'FAIL' if errors else 'PASS', 'errors': errors, 'observations': observations}, ensure_ascii=False, indent=2))
    return 1 if errors else 0

if __name__ == '__main__':
    sys.exit(main())
