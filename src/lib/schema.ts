import { z } from 'zod';

export const SiteSchema = z.object({
  handle: z.string().min(1),
  eyebrow: z.string().optional(),
  intro: z.string().optional(),
  links: z.array(
    z.object({
      label: z.string().min(1),
      href: z.string().url(),
      verified: z.boolean().optional().default(true),
    }),
  ),
  note: z.object({
    head: z.string().optional(),
    body: z.string().min(1),
    tags: z.array(z.string()).default([]),
  }),
  featured: z.array(
    z.object({
      match: z.string().min(1),
      tag: z.string().optional(),
      href: z.string().url().optional(),
      verified: z.boolean().optional().default(true),
    }),
  ),
  seo: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
  }),
});

export type Site = z.infer<typeof SiteSchema>;

const ContactSchema = z.object({
  text: z.string(),
  url: z.string().optional(),
});

const SectionItemSchema = z
  .object({
    title: z.string().optional(),
    org: z.string().optional(),
    where: z.string().optional(),
    start: z.union([z.string(), z.number()]).optional(),
    end: z.union([z.string(), z.number()]).optional(),
    date: z.union([z.string(), z.number()]).optional(),
    when: z.string().optional(),
    url: z.string().optional(),
    text: z.string().optional(),
    label: z.string().optional(),
    label_width: z.string().optional(),
    bullets: z.array(z.string()).optional(),
    priority: z.number().optional(),
  })
  .passthrough();

const SectionSchema = z.object({
  type: z.string(),
  title: z.string().optional(),
  text: z.string().optional(),
  label_width: z.string().optional(),
  priority: z.number().optional(),
  item: z.array(SectionItemSchema).optional(),
});

export const CvSchema = z.object({
  meta: z.object({
    name: z.string().min(1),
    tagline: z.string().optional(),
    contacts: z.array(ContactSchema).default([]),
  }),
  section: z.array(SectionSchema),
  languages: z
    .record(
      z.string(),
      z.object({
        present: z.string().optional(),
        months: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  variants: z.record(z.string(), z.unknown()).optional(),
});

export type Cv = z.infer<typeof CvSchema>;
