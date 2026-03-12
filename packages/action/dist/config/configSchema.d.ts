import { z } from "zod";
export declare const ProvenanceYmlSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    mode: z.ZodDefault<z.ZodEnum<["internal", "oss"]>>;
    require_attestation: z.ZodDefault<z.ZodBoolean>;
    attestation_reminder: z.ZodDefault<z.ZodBoolean>;
    labels: z.ZodDefault<z.ZodObject<{
        high: z.ZodDefault<z.ZodString>;
        medium: z.ZodDefault<z.ZodString>;
        low: z.ZodDefault<z.ZodString>;
        none: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        high: string;
        medium: string;
        low: string;
        none?: string | undefined;
    }, {
        high?: string | undefined;
        medium?: string | undefined;
        low?: string | undefined;
        none?: string | undefined;
    }>>;
    signals: z.ZodDefault<z.ZodObject<{
        min_dwell_minutes: z.ZodDefault<z.ZodNumber>;
        min_entropy_score: z.ZodDefault<z.ZodNumber>;
        require_test_run: z.ZodDefault<z.ZodBoolean>;
        ai_disclosure_prompt: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        min_dwell_minutes: number;
        min_entropy_score: number;
        require_test_run: boolean;
        ai_disclosure_prompt: boolean;
    }, {
        min_dwell_minutes?: number | undefined;
        min_entropy_score?: number | undefined;
        require_test_run?: boolean | undefined;
        ai_disclosure_prompt?: boolean | undefined;
    }>>;
    fast_lane: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        sla_hours: z.ZodDefault<z.ZodNumber>;
        label: z.ZodDefault<z.ZodString>;
        standard_label: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        sla_hours: number;
        label: string;
        standard_label: string;
    }, {
        enabled?: boolean | undefined;
        sla_hours?: number | undefined;
        label?: string | undefined;
        standard_label?: string | undefined;
    }>>;
    privacy: z.ZodDefault<z.ZodObject<{
        upload_paste_content: z.ZodDefault<z.ZodLiteral<false>>;
        upload_command_args: z.ZodDefault<z.ZodLiteral<false>>;
    }, "strip", z.ZodTypeAny, {
        upload_paste_content: false;
        upload_command_args: false;
    }, {
        upload_paste_content?: false | undefined;
        upload_command_args?: false | undefined;
    }>>;
    notifications: z.ZodDefault<z.ZodObject<{
        slack_webhook: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        comment_on_pr: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        slack_webhook: string | null;
        comment_on_pr: boolean;
    }, {
        slack_webhook?: string | null | undefined;
        comment_on_pr?: boolean | undefined;
    }>>;
    bypass: z.ZodDefault<z.ZodObject<{
        users: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        labels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        labels: string[];
        users: string[];
    }, {
        labels?: string[] | undefined;
        users?: string[] | undefined;
    }>>;
    server_metrics: z.ZodDefault<z.ZodBoolean>;
    cross_validate: z.ZodDefault<z.ZodBoolean>;
    no_attestation_action: z.ZodDefault<z.ZodEnum<["remind", "label-only", "ignore"]>>;
}, "strip", z.ZodTypeAny, {
    version: 1;
    mode: "internal" | "oss";
    require_attestation: boolean;
    attestation_reminder: boolean;
    labels: {
        high: string;
        medium: string;
        low: string;
        none?: string | undefined;
    };
    signals: {
        min_dwell_minutes: number;
        min_entropy_score: number;
        require_test_run: boolean;
        ai_disclosure_prompt: boolean;
    };
    fast_lane: {
        enabled: boolean;
        sla_hours: number;
        label: string;
        standard_label: string;
    };
    privacy: {
        upload_paste_content: false;
        upload_command_args: false;
    };
    notifications: {
        slack_webhook: string | null;
        comment_on_pr: boolean;
    };
    bypass: {
        labels: string[];
        users: string[];
    };
    server_metrics: boolean;
    cross_validate: boolean;
    no_attestation_action: "remind" | "label-only" | "ignore";
}, {
    version: 1;
    mode?: "internal" | "oss" | undefined;
    require_attestation?: boolean | undefined;
    attestation_reminder?: boolean | undefined;
    labels?: {
        high?: string | undefined;
        medium?: string | undefined;
        low?: string | undefined;
        none?: string | undefined;
    } | undefined;
    signals?: {
        min_dwell_minutes?: number | undefined;
        min_entropy_score?: number | undefined;
        require_test_run?: boolean | undefined;
        ai_disclosure_prompt?: boolean | undefined;
    } | undefined;
    fast_lane?: {
        enabled?: boolean | undefined;
        sla_hours?: number | undefined;
        label?: string | undefined;
        standard_label?: string | undefined;
    } | undefined;
    privacy?: {
        upload_paste_content?: false | undefined;
        upload_command_args?: false | undefined;
    } | undefined;
    notifications?: {
        slack_webhook?: string | null | undefined;
        comment_on_pr?: boolean | undefined;
    } | undefined;
    bypass?: {
        labels?: string[] | undefined;
        users?: string[] | undefined;
    } | undefined;
    server_metrics?: boolean | undefined;
    cross_validate?: boolean | undefined;
    no_attestation_action?: "remind" | "label-only" | "ignore" | undefined;
}>;
export type ProvenanceYmlConfig = z.infer<typeof ProvenanceYmlSchema>;
//# sourceMappingURL=configSchema.d.ts.map