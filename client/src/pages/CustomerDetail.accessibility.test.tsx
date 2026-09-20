import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import * as select from "@/components/ui/select";

// The modals remain private to the page. Compile their real declarations for
// isolated SSR checks; browser E2E separately verifies computed names and input.
// Only the portal shell, queries and option data are substituted, not fields.
const source = ts.createSourceFile(
  "CustomerDetail.tsx",
  readFileSync(new URL("./CustomerDetail.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
);
function modal(name: string, calendar = false): React.ComponentType<any> {
  const declaration = source.statements.find(
    node => ts.isFunctionDeclaration(node) && node.name?.text === name
  );
  if (!declaration) throw new Error(`Missing real modal declaration: ${name}`);
  const code = ts.transpileModule(declaration.getText(source), {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const scope = {
    React,
    useId: React.useId,
    useState: (initial: any) =>
      React.useState(calendar && initial === false ? true : initial),
    Input,
    Label,
    Button,
    Checkbox,
    ...select,
    Dialog: Wrapper,
    DialogContent: Wrapper,
    DialogHeader: Wrapper,
    DialogTitle: Wrapper,
    trpc: {
      settings: { formOptions: { useQuery: () => ({ data: [] }) } },
      users: { list: { useQuery: () => ({ data: [] }) } },
    },
    CONSULT_STATUSES: ["미상담"],
    CONSULTATION_TYPES: ["전화"],
    CUSTOMER_NEEDS: ["기타"],
    CUSTOMER_NEXT_ACTIONS: ["재연락"],
    linkedScheduleReminderOptions: [{ value: "30", label: "30분 전" }],
    formatKstLocalDateTime: (value: string) => value,
    formatUserWithRole: () => "[TEST] 담당자",
    toast: { error: vi.fn() },
  };
  return new Function(...Object.keys(scope), `${code}; return ${name};`)(
    ...Object.values(scope)
  );
}
const createProps = {
  open: true,
  currentStatus: "미상담",
  loading: false,
  onClose() {},
  onSubmit() {},
};
const editProps = {
  ...createProps,
  consult: { status: "미상담", summary: "[TEST] 요약", content: "[TEST] 메모" },
};
const contractProps = {
  ...createProps,
  currentUserRole: "branch_admin",
  customerAgentId: null,
};
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

function fields(html: string) {
  return Array.from(
    html.matchAll(/<(label|input|textarea|button)\b([^>]*)(?:>([^<]*)|\/?>)/g)
  ).map(match => {
    const attributes = Object.fromEntries(
      Array.from(match[2].matchAll(/([\w-]+)="([^"]*)"/g)).map(a => [
        a[1],
        a[2],
      ])
    );
    return { tag: match[1], attributes, text: (match[3] ?? "").trim() };
  });
}
function assertAssociation(
  html: string,
  name: string,
  kind: "native" | "select"
) {
  const all = fields(html);
  const label = all.find(field => field.tag === "label" && field.text === name);
  expect(label, `visible label: ${name}`).toBeDefined();
  if (kind === "native") {
    expect(label!.attributes.for, `htmlFor: ${name}`).toBeTruthy();
    const controls = all.filter(
      field =>
        ["input", "textarea"].includes(field.tag) &&
        field.attributes.id === label!.attributes.for
    );
    expect(controls, `one linked native input: ${name}`).toHaveLength(1);
  } else {
    expect(label!.attributes.id, `label id: ${name}`).toBeTruthy();
    const controls = all.filter(
      field =>
        field.attributes.role === "combobox" &&
        field.attributes["aria-labelledby"] === label!.attributes.id
    );
    expect(
      controls,
      `one trigger named from visible label: ${name}`
    ).toHaveLength(1);
  }
}
describe("P2-05 real modal field associations (computed names covered by Playwright)", () => {
  const consult = [
    ["T01", "상담상태", "select"],
    ["T02", "상담유형", "select"],
    ["T03", "고객 니즈", "select"],
    ["T04", "다음 액션", "select"],
    ["T05", "상담 요약", "native"],
    ["T06", "상세 메모", "native"],
    ["T07", "재상담 예정일", "native"],
    ["T08", "일정 제목", "native"],
    ["T09", "알림", "select"],
  ] as const;
  it.each(consult)("%s consult create: %s", (_id, name, kind) => {
    const Component = modal("ConsultModal", true);
    assertAssociation(
      renderToStaticMarkup(<Component {...createProps} />),
      name,
      kind
    );
  });
  it.each(consult.slice(0, 7))(
    "T10/T11 consult edit: %s %s",
    (_id, name, kind) => {
      const Component = modal("EditConsultModal");
      assertAssociation(
        renderToStaticMarkup(<Component {...editProps} />),
        name,
        kind
      );
    }
  );
  const contracts = [
    ["T12", "보험사", "native"],
    ["T13", "상품명", "native"],
    ["T14", "상품군", "native"],
    ["T15", "계약일", "native"],
    ["T16", "월보험료 (원)", "native"],
    ["T17", "납입상태", "select"],
    ["T18", "계약상태", "select"],
    ["T19", "담당 설계사", "select"],
    ["T20", "메모", "native"],
  ] as const;
  for (const mode of ["create", "edit"]) {
    it.each(contracts)(`%s contract ${mode}: %s`, (_id, name, kind) => {
      const Component = modal("ContractModal");
      assertAssociation(
        renderToStaticMarkup(
          <Component
            {...contractProps}
            contract={mode === "edit" ? { agentId: 4 } : undefined}
          />
        ),
        name,
        kind
      );
    });
  }
  it("IDs and datalist references remain unique with create/edit instances mounted together", () => {
    const Consult = modal("ConsultModal", true),
      Edit = modal("EditConsultModal"),
      Contract = modal("ContractModal");
    const html = renderToStaticMarkup(
      <>
        <Consult {...createProps} />
        <Edit {...editProps} />
        <Contract {...contractProps} />
        <Contract {...contractProps} contract={{ agentId: 4 }} />
      </>
    );
    const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g)).map(m => m[1]);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
    for (const reference of Array.from(
      html.matchAll(
        /\b(?:for|aria-labelledby|aria-describedby|list)="([^"]+)"/g
      )
    )) {
      for (const id of reference[1].split(" ")) expect(ids).toContain(id);
    }
  });
});
