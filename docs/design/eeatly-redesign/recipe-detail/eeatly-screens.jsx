// eeatly-screens.jsx — 12 redesigned screens

// ═══ HELPERS ══════════════════════════════════════════════════
const FieldLabel = ({ children }) => {
  const E = useT();
  return (
    <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 14, color: E.ink, marginBottom: 8, letterSpacing: -0.1 }}>{children}</div>
  );
};

const Field = ({ value, placeholder, mono, suffix, ghost }) => {
  const E = useT();
  return (
    <div style={{
      background: ghost ? 'transparent' : E.surface,
      border: `1px solid ${E.border}`, borderRadius: 12,
      padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: mono ? F.mono : F.body, fontSize: 15,
      color: value ? E.ink : E.ink3,
    }}>
      <span>{value || placeholder}</span>
      {suffix}
    </div>
  );
};

const SectionLabel = ({ children, action }) => {
  const E = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 }}>
      <div style={{
        fontFamily: F.body, fontWeight: 600, fontSize: 11.5,
        letterSpacing: 1.4, textTransform: 'uppercase', color: E.ink2,
      }}>{children}</div>
      {action}
    </div>
  );
};

// ═══ 1. HOME ══════════════════════════════════════════════════
function ScreenHome({ dark = false }) {
  const E = dark ? E_DARK : E_LIGHT;
  return (
    <Phone dark={dark}>
      <NavBar title="Home" right={<div style={{ color: E.forest }}>{I.gear(22)}</div>} divider={false} />
      <Content pad={22}>
        {/* Editorial greeting */}
        <div style={{ marginTop: 8, marginBottom: 28 }}>
          <div style={{
            fontFamily: F.display, fontSize: 18, fontStyle: 'italic',
            color: E.ink2, marginBottom: 2, letterSpacing: 0.1,
          }}>Good evening,</div>
          <div style={{
            fontFamily: F.display, fontSize: 56, lineHeight: 1, color: E.ink,
            letterSpacing: '-0.02em', marginBottom: 10,
          }}>Saif.</div>
          <div style={{
            fontFamily: F.mono, fontSize: 11.5, color: E.ink3,
            letterSpacing: 1.5, textTransform: 'uppercase',
          }}>Fri · May 15 · 2026</div>
        </div>

        {/* Recent meals */}
        <SectionLabel>Recently cooked</SectionLabel>
        <div style={{
          display: 'flex', gap: 12, overflowX: 'auto',
          marginLeft: -22, marginRight: -22, padding: '2px 22px 4px',
        }}>
          {[
            { name: 'Chowmein Noodles', when: '4 days ago' },
            { name: 'Chicken Biryani', when: '6 days ago' },
            { name: 'Daal Tadka', when: '9 days ago' },
            { name: 'Aloo Paratha', when: '12 days ago' },
          ].map(m => (
            <div key={m.name} style={{ width: 148, flexShrink: 0 }}>
              <div style={{ width: 148, height: 148, marginBottom: 10 }}>
                <MealTile name={m.name} size="lg" radius={10} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: E.ink, lineHeight: 1.25, marginBottom: 3, letterSpacing: -0.1 }}>{m.name}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10.5, color: E.ink3, letterSpacing: 0.6, textTransform: 'uppercase' }}>{m.when}</div>
            </div>
          ))}
        </div>

        {/* Most cooked */}
        <div style={{ marginTop: 28 }}>
          <SectionLabel>Most cooked</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { name: 'Chicken Biryani', count: 2 },
              { name: 'Chowmein Noodles', count: 1 },
            ].map(m => (
              <div key={m.name} style={{
                background: E.surface, borderRadius: 12,
                border: `1px solid ${E.borderSoft}`,
                overflow: 'hidden',
              }}>
                <div style={{ height: 90 }}>
                  <MealTile name={m.name} size="md" radius={0} />
                </div>
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: E.ink, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <div style={{
                      fontFamily: F.display, fontSize: 18, fontStyle: 'italic', color: E.forest, lineHeight: 1,
                    }}>×{m.count}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: E.ink3, letterSpacing: 0.5, textTransform: 'uppercase' }}>cooked</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div style={{ marginTop: 28 }}>
          <SectionLabel action={
            <span style={{ fontSize: 12.5, fontWeight: 600, color: E.forest, letterSpacing: -0.1 }}>View all</span>
          }>Upcoming plans</SectionLabel>
          <Card padding={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconBubble size={44} bg={E.sageBg} fg={E.forest}>{I.calendar(20)}</IconBubble>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: E.ink, letterSpacing: -0.1 }}>Eid Al Adha</div>
                <div style={{ fontFamily: F.mono, fontSize: 10.5, color: E.ink3, marginTop: 2, letterSpacing: 0.6, textTransform: 'uppercase' }}>Yesterday · 2 dishes</div>
              </div>
              <div style={{ color: E.ink3 }}>{I.chevronRight(18)}</div>
            </div>
          </Card>
        </div>
      </Content>
      <TabBar active="home" />
    </Phone>
  );
}

// ═══ 2. PLANS LIST ════════════════════════════════════════════
function ScreenPlans({ dark = false }) {
  const E = dark ? E_DARK : E_LIGHT;
  return (
    <Phone dark={dark}>
      <NavBar title="Plans" right={<div style={{ color: E.forest }}>{I.gear(22)}</div>} />
      <Content pad={22}>
        <div style={{ marginTop: 12, marginBottom: 22 }}>
          <div style={{ fontFamily: F.display, fontSize: 44, lineHeight: 1, color: E.ink, letterSpacing: '-0.02em', marginBottom: 6 }}>Plans</div>
          <div style={{ fontSize: 14, color: E.ink2, lineHeight: 1.4 }}>Occasion menus, dinners, weeknight cooks.</div>
        </div>

        <Card padding={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconBubble size={48} bg={E.sageBg} fg={E.forest}>{I.calendar(22)}</IconBubble>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: E.ink, letterSpacing: -0.1 }}>Eid Al Adha</div>
              <div style={{ fontFamily: F.mono, fontSize: 10.5, color: E.ink3, marginTop: 3, letterSpacing: 0.6, textTransform: 'uppercase' }}>Yesterday · 2 dishes</div>
            </div>
            <div style={{ color: E.ink3 }}>{I.chevronRight(18)}</div>
          </div>
        </Card>

        {/* Empty hint */}
        <div style={{ marginTop: 36, textAlign: 'center', color: E.ink3, fontSize: 13 }}>
          <div style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 22, color: E.ink2, marginBottom: 6 }}>One plan so far.</div>
          <div style={{ maxWidth: 260, margin: '0 auto', lineHeight: 1.5 }}>Use plans for menus tied to a date — Eid, Diwali, a dinner party.</div>
        </div>
      </Content>
      {/* Floating add */}
      <div style={{
        position: 'absolute', bottom: 116, right: 22,
        width: 56, height: 56, borderRadius: 99,
        background: E.forest, color: E.forestText,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: E.ctaShadow + ', 0 1px 0 rgba(255,255,255,0.08) inset',
      }}>{I.plus(24)}</div>
      <TabBar active="home" />
    </Phone>
  );
}

// ═══ 3. PLAN DETAIL ═══════════════════════════════════════════
function ScreenPlanDetail({ withSheet = false, dark = false } = {}) {
  const E = dark ? E_DARK : E_LIGHT;
  return (
    <Phone dark={dark}>
      <NavBar
        title="Eid Al Adha"
        left={<div style={{ color: E.forest, display: 'flex', alignItems: 'center', gap: 2 }}>{I.chevronLeft(22)}</div>}
        right={<div style={{ color: E.forest }}>{I.edit(20)}</div>}
      />
      <Content pad={22}>
        <div style={{ marginTop: 8, marginBottom: 18 }}>
          <div style={{ fontFamily: F.display, fontSize: 46, lineHeight: 1, color: E.ink, letterSpacing: '-0.02em', marginBottom: 10 }}>Eid Al Adha</div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: E.ink3, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 14 }}>Thu · May 14 · 2026</div>
          <Chip icon={I.gauge(14)} tone="sage">2 dishes · medium</Chip>
        </div>

        <SectionLabel>Dishes</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          {['Chicken Biryani', 'Chowmein Noodles Recipe'].map(name => (
            <Card key={name} padding={12} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, flexShrink: 0 }}>
                <MealTile name={name} size="sm" radius={8} />
              </div>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: E.ink, letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ color: E.ink3 }}>{I.edit(18)}</div>
            </Card>
          ))}
        </div>

        <button style={{
          width: '100%', padding: '16px', border: 'none', borderRadius: 99,
          background: E.forest, color: E.forestText,
          fontFamily: F.body, fontSize: 15.5, fontWeight: 600, letterSpacing: -0.1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset',
        }}>
          {I.plusCircle(20)} Add dish to plan
        </button>
      </Content>

      {withSheet && <AddDishSheet dark={dark} />}
      <TabBar active="home" />
    </Phone>
  );
}

// ═══ 4. EDIT PLAN ═════════════════════════════════════════════
function ScreenEditPlan({ dark = false }) {
  const E = dark ? E_DARK : E_LIGHT;
  return (
    <Phone dark={dark}>
      <NavBar
        title="Edit plan"
        left={<span style={{ color: E.forest, fontSize: 15, fontWeight: 500 }}>Cancel</span>}
        right={<span style={{ color: E.forest, fontSize: 15, fontWeight: 600 }}>Save</span>}
      />
      <Content pad={22}>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <FieldLabel>Plan name</FieldLabel>
            <Field value="Eid Al Adha" />
          </div>
          <div>
            <FieldLabel>Planned date</FieldLabel>
            <Field value="Thu, May 14, 2026" mono suffix={<span style={{ color: E.ink3 }}>{I.calendar(18)}</span>} />
          </div>
          <div>
            <FieldLabel>Notes <span style={{ fontWeight: 400, color: E.ink3 }}>· optional</span></FieldLabel>
            <div style={{
              background: E.surface, border: `1px solid ${E.border}`, borderRadius: 12,
              padding: '14px 16px', minHeight: 96, color: E.ink3, fontSize: 15,
            }}>For the family. Cooking with mom.</div>
          </div>
        </div>

        <div style={{
          marginTop: 32, padding: '14px 16px',
          background: E.dangerSoft, border: `1px solid ${E.danger}22`,
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: E.danger, letterSpacing: -0.1 }}>Delete plan</div>
            <div style={{ fontSize: 12.5, color: E.danger, opacity: 0.75, marginTop: 2 }}>Dishes stay in your library.</div>
          </div>
          <div style={{ color: E.danger }}>{I.chevronRight(18)}</div>
        </div>
      </Content>
      <TabBar active="home" />
    </Phone>
  );
}

// ═══ 5. ADD DISH SHEET (modal over plan detail) ═══════════════
function AddDishSheet({ dark = false }) {
  const E = dark ? E_DARK : E_LIGHT;
  return (
    <>
      {/* dim */}
      <div style={{ position: 'absolute', inset: 0, background: E.scrim, zIndex: 12 }} />
      {/* sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: E.paper, borderRadius: '22px 22px 0 0',
        padding: '12px 0 0', zIndex: 13,
        boxShadow: dark ? '0 -20px 40px -10px rgba(0,0,0,0.5)' : '0 -20px 40px -10px rgba(20,20,15,0.18)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: E.ink4, margin: '0 auto 14px' }} />
        <div style={{ padding: '4px 22px 24px' }}>
          <div style={{ fontFamily: F.display, fontSize: 28, color: E.ink, letterSpacing: '-0.02em', marginBottom: 14 }}>Add a dish</div>
          <div style={{
            background: E.cream, border: `1px solid ${E.border}`, borderRadius: 12,
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          }}>
            <span style={{ color: E.ink3 }}>{I.search(18)}</span>
            <span style={{ color: E.ink3, fontSize: 15 }}>Search your meals…</span>
          </div>
          {['Chicken Biryani', 'Chowmein Noodles Recipe', 'Daal Tadka'].map((n, i) => (
            <div key={n} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 4px',
              borderTop: i === 0 ? 'none' : `1px solid ${E.borderSoft}`,
            }}>
              <div style={{ width: 36, height: 36, flexShrink: 0 }}>
                <MealTile name={n} size="sm" radius={8} />
              </div>
              <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: E.ink, letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</div>
              <div style={{
                width: 32, height: 32, borderRadius: 99,
                border: `1.5px solid ${E.forest}`, color: E.forest,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{I.plus(16)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ═══ 6. ADD HUB ═══════════════════════════════════════════════
function ScreenAdd({ dark = false }) {
  const E = dark ? E_DARK : E_LIGHT;
  const Item = ({ icon, title, sub, primary }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '16px 16px',
      borderRadius: 14,
      background: primary ? E.forest : E.surface,
      border: primary ? 'none' : `1px solid ${E.borderSoft}`,
      color: primary ? E.forestText : E.ink,
      boxShadow: primary ? E.ctaShadow : E.cardShadow,
    }}>
      <IconBubble
        size={42}
        bg={primary ? 'rgba(255,255,255,0.12)' : E.sageBg}
        fg={primary ? E.forestText : (dark ? E.forestSoft : E.forest)}
      >{icon}</IconBubble>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: -0.15, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: primary ? (dark ? 'rgba(16,24,15,0.65)' : 'rgba(245,239,226,0.75)') : E.ink2, lineHeight: 1.35 }}>{sub}</div>
      </div>
      <div style={{ color: primary ? (dark ? 'rgba(16,24,15,0.55)' : 'rgba(245,239,226,0.7)') : E.ink3 }}>{I.chevronRight(18)}</div>
    </div>
  );

  return (
    <Phone dark={dark}>
      <NavBar title="Add" right={<div style={{ color: E.forest }}>{I.gear(22)}</div>} divider={false} />
      <Content pad={22}>
        <div style={{ marginTop: 8, marginBottom: 22 }}>
          <div style={{ fontFamily: F.display, fontSize: 44, lineHeight: 1, color: E.ink, letterSpacing: '-0.02em', marginBottom: 10 }}>Add a meal</div>
          <div style={{ fontSize: 14, color: E.ink2, lineHeight: 1.45 }}>Quick-log if you know what you cooked, or let AI lift a recipe from a photo, voice note, or pasted text.</div>
        </div>

        <SectionLabel>Capture</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          <Item primary icon={I.cutlery(22)} title="Log a meal I cooked" sub="Name, when, optional photo + notes." />
          <Item icon={I.sparkle(22)} title="Capture with AI" sub="Photo, voice note, or pasted text." />
          <Item icon={I.link(20)} title="Save a link" sub="YouTube, TikTok, Pinterest, or a recipe URL." />
        </div>

        <SectionLabel>Plans</SectionLabel>
        <Item icon={I.calendar(20)} title="Plan an occasion menu" sub="Eid, Diwali, dinner party." />
      </Content>
      <TabBar active="add" />
    </Phone>
  );
}

// ═══ 7. LOG A MEAL ════════════════════════════════════════════
function ScreenLogMeal({ dark = false }) {
  const E = dark ? E_DARK : E_LIGHT;
  return (
    <Phone dark={dark}>
      <NavBar
        title="Log a meal"
        left={<span style={{ color: E.forest, fontSize: 15, fontWeight: 500 }}>Cancel</span>}
        right={<span style={{ color: E.forest, fontSize: 15, fontWeight: 600 }}>Save</span>}
      />
      <Content pad={22}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 14 }}>
          <div>
            <FieldLabel>Meal name</FieldLabel>
            <Field placeholder="What did you cook?" />
          </div>
          <div>
            <FieldLabel>When</FieldLabel>
            <Field value="Today" mono suffix={<span style={{ color: E.ink3 }}>{I.calendar(18)}</span>} />
          </div>

          <div>
            <FieldLabel>Photo <span style={{ fontWeight: 400, color: E.ink3 }}>· optional</span></FieldLabel>
            <div style={{
              height: 180, borderRadius: 14,
              border: `1.5px dashed ${E.border}`,
              background: E.creamSoft,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 6, color: E.ink2, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `repeating-linear-gradient(135deg, ${E.borderSoft} 0 1px, transparent 1px 14px)`,
                opacity: 0.6,
              }} />
              <div style={{ color: E.forest, position: 'relative' }}>{I.image(28)}</div>
              <div style={{ fontWeight: 600, color: E.ink, fontSize: 15, position: 'relative' }}>Add a photo</div>
              <div style={{ fontFamily: F.mono, fontSize: 10.5, color: E.ink3, letterSpacing: 0.6, textTransform: 'uppercase', position: 'relative' }}>Camera or library</div>
            </div>
          </div>

          <div>
            <FieldLabel>Effort</FieldLabel>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              background: E.surface, border: `1px solid ${E.border}`, borderRadius: 99,
              padding: 4, gap: 2,
            }}>
              {['Quick', 'Easy', 'Medium', 'High'].map((l, i) => {
                const on = i === 1;
                return (
                  <div key={l} style={{
                    textAlign: 'center', padding: '9px 0',
                    borderRadius: 99,
                    background: on ? E.forest : 'transparent',
                    color: on ? E.forestText : E.ink2,
                    fontSize: 13.5, fontWeight: on ? 600 : 500, letterSpacing: -0.1,
                  }}>{l}</div>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel>Notes <span style={{ fontWeight: 400, color: E.ink3 }}>· optional</span></FieldLabel>
            <div style={{
              background: E.surface, border: `1px solid ${E.border}`, borderRadius: 12,
              padding: '14px 16px', minHeight: 90, color: E.ink3, fontSize: 14.5, lineHeight: 1.45,
              fontStyle: 'italic', fontFamily: F.display,
            }}>Doubled the garlic. Used chicken stock instead of water…</div>
            <div style={{ fontFamily: F.mono, fontSize: 10.5, color: E.ink3, letterSpacing: 0.5, marginTop: 8, textTransform: 'uppercase' }}>What worked, what to change next time.</div>
          </div>

          <div>
            <FieldLabel>Source URL <span style={{ fontWeight: 400, color: E.ink3 }}>· optional</span></FieldLabel>
            <Field placeholder="https://youtube.com/…" mono />
          </div>
        </div>
      </Content>
      <TabBar active="add" />
    </Phone>
  );
}

// ═══ 8. CAPTURE WITH AI ═══════════════════════════════════════
function ScreenCaptureAI({ dark = false }) {
  const E = dark ? E_DARK : E_LIGHT;
  const Tab = ({ icon, label, on }) => (
    <div style={{
      flex: 1, padding: '11px 0', borderRadius: 99,
      background: on ? E.forest : E.surface,
      border: on ? 'none' : `1px solid ${E.border}`,
      color: on ? E.forestText : E.ink2,
      fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    }}>
      {icon}{label}
    </div>
  );

  return (
    <Phone dark={dark}>
      <NavBar
        title="Capture with AI"
        left={<div style={{ color: E.forest }}>{I.chevronLeft(22)}</div>}
        right={<div style={{ color: E.forest }}>{I.gear(22)}</div>}
      />
      <Content pad={22}>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 22 }}>
          <Tab on icon={I.camera(16)} label="Photo" />
          <Tab icon={I.document(16)} label="Text" />
          <Tab icon={I.mic(16)} label="Voice" />
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: F.display, fontSize: 36, lineHeight: 1, color: E.ink, letterSpacing: '-0.02em', marginBottom: 10 }}>Capture a recipe.</div>
          <div style={{ fontSize: 14, color: E.ink2, lineHeight: 1.5 }}>Snap a recipe card, cookbook page, or finished dish. We'll lift the name, ingredients, and steps — then you review before saving.</div>
        </div>

        <div style={{
          borderRadius: 18, background: E.forest, color: E.forestText,
          padding: '32px 24px 28px', textAlign: 'center', marginBottom: 18,
          position: 'relative', overflow: 'hidden',
          boxShadow: E.ctaShadow,
        }}>
          {/* faint dotted pattern */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `radial-gradient(circle, ${dark ? 'rgba(16,24,15,0.12)' : 'rgba(255,255,255,0.08)'} 1px, transparent 1.4px)`,
            backgroundSize: '16px 16px', pointerEvents: 'none',
          }} />
          <div style={{
            width: 60, height: 60, borderRadius: 99,
            background: dark ? 'rgba(16,24,15,0.18)' : 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', position: 'relative',
          }}>{I.camera(28)}</div>
          <div style={{ fontFamily: F.display, fontSize: 28, letterSpacing: '-0.02em', marginBottom: 6, position: 'relative' }}>Add a photo</div>
          <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.75, position: 'relative' }}>Camera · library</div>
        </div>

        <Card padding={16}>
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 11.5, letterSpacing: 1.4, textTransform: 'uppercase', color: E.ink3, marginBottom: 10 }}>For sharper results</div>
          {[
            'Hold the phone parallel to the page.',
            'Make sure the whole recipe is in frame.',
            'Bright, even light helps with handwriting.',
          ].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0' }}>
              <div style={{ marginTop: 2, color: dark ? E.forestSoft : E.forest, flexShrink: 0 }}>{I.lightbulb(16)}</div>
              <div style={{ fontSize: 13.5, color: E.ink, lineHeight: 1.45 }}>{t}</div>
            </div>
          ))}
        </Card>
      </Content>
      <TabBar active="add" />
    </Phone>
  );
}

// ═══ 9. LIBRARY ═══════════════════════════════════════════════
function ScreenLibrary({ dark = false }) {
  const E = dark ? E_DARK : E_LIGHT;
  const items = [
    { name: 'Chicken Biryani', meta: '6 days ago · medium' },
    { name: 'Chowmein Noodles Recipe', meta: '4 days ago · easy' },
    { name: 'Daal Tadka', meta: '9 days ago · quick' },
    { name: 'Aloo Paratha', meta: '12 days ago · medium' },
    { name: 'Beef Karahi', meta: '3 weeks ago · high' },
  ];
  return (
    <Phone dark={dark}>
      <NavBar title="Library" right={<div style={{ color: E.forest }}>{I.gear(22)}</div>} />
      <Content pad={22}>
        <div style={{ marginTop: 12, marginBottom: 20 }}>
          <div style={{ fontFamily: F.display, fontSize: 44, lineHeight: 1, color: E.ink, letterSpacing: '-0.02em', marginBottom: 6 }}>Library</div>
          <div style={{ fontSize: 14, color: E.ink2, lineHeight: 1.4 }}>Every meal cooked in your kitchen.</div>
        </div>

        <div style={{
          background: E.surface, border: `1px solid ${E.border}`, borderRadius: 99,
          padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        }}>
          <span style={{ color: E.ink3 }}>{I.search(18)}</span>
          <span style={{ color: E.ink3, fontSize: 14.5 }}>Search by name…</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', marginLeft: -22, marginRight: -22, padding: '2px 22px' }}>
          {['All · 5', 'Recent', 'Most cooked', 'Quick', 'High effort'].map((c, i) => (
            <div key={c} style={{
              padding: '7px 13px', borderRadius: 99,
              background: i === 0 ? E.sageBg : 'transparent',
              border: i === 0 ? 'none' : `1px solid ${E.border}`,
              color: i === 0 ? (dark ? E.forestSoft : E.forest) : E.ink2,
              fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: -0.1,
            }}>{c}</div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(m => (
            <Card key={m.name} padding={10} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, flexShrink: 0 }}>
                <MealTile name={m.name} size="sm" radius={8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: E.ink, letterSpacing: -0.1, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10.5, color: E.ink3, letterSpacing: 0.5, textTransform: 'uppercase' }}>{m.meta}</div>
              </div>
              <div style={{ color: E.ink3 }}>{I.chevronRight(18)}</div>
            </Card>
          ))}
        </div>
      </Content>
      <TabBar active="library" />
    </Phone>
  );
}

// ═══ 10. SETTINGS ═════════════════════════════════════════════
function ScreenSettings({ dark = false }) {
  const E = dark ? E_DARK : E_LIGHT;
  const Row = ({ label, value, sub, suffix, divider }) => (
    <div style={{
      padding: '14px 16px',
      borderTop: divider ? `1px solid ${E.borderSoft}` : 'none',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: E.ink, letterSpacing: -0.1 }}>{label}</div>
        {sub && <div style={{ fontSize: 13, color: E.ink2, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {value && <div style={{ fontSize: 14, color: E.ink2, fontFamily: F.mono, fontSize: 12.5, letterSpacing: 0.2 }}>{value}</div>}
      {suffix}
    </div>
  );

  return (
    <Phone dark={dark}>
      <NavBar title="Settings" right={<div style={{ color: E.forest }}>{I.gear(22)}</div>} />
      <Content pad={22}>
        <div style={{ marginTop: 12, marginBottom: 22 }}>
          <div style={{ fontFamily: F.display, fontSize: 44, lineHeight: 1, color: E.ink, letterSpacing: '-0.02em' }}>Settings</div>
        </div>

        <SectionLabel>Account</SectionLabel>
        <Card padding={0} style={{ marginBottom: 22 }}>
          <Row label="Name" value="alex.rivers" />
          <Row divider label="Email" value="alex@example.com" />
        </Card>

        <SectionLabel>Plan</SectionLabel>
        <Card padding={0} style={{ marginBottom: 22 }}>
          <Row label="Current plan" suffix={<Chip tone="ghost">Free</Chip>} />
          <Row divider label="See Plus features" suffix={<span style={{ color: dark ? E.forestSoft : E.forest }}>{I.external(16)}</span>} />
        </Card>

        <SectionLabel>Kitchen</SectionLabel>
        <Card padding={0} style={{ marginBottom: 22 }}>
          <Row label="Members + invitations" sub="Just you · 1 pending invite" suffix={<span style={{ color: E.ink3 }}>{I.chevronRight(18)}</span>} />
        </Card>

        <SectionLabel>Advanced</SectionLabel>
        <Card padding={0}>
          <Row label="Manage account on web" sub="Edit profile, delete account, subscription." suffix={<span style={{ color: dark ? E.forestSoft : E.forest }}>{I.external(16)}</span>} />
        </Card>

        <div style={{ textAlign: 'center', marginTop: 28, fontFamily: F.mono, fontSize: 10.5, color: E.ink3, letterSpacing: 1.4, textTransform: 'uppercase' }}>eeatly · v2.1</div>
      </Content>
      <TabBar active="home" />
    </Phone>
  );
}

// ═══ 11. KITCHEN MEMBERS ══════════════════════════════════════
function ScreenKitchen({ dark = false }) {
  const E = dark ? E_DARK : E_LIGHT;
  return (
    <Phone dark={dark}>
      <NavBar
        title="Kitchen"
        left={<div style={{ color: E.forest }}>{I.chevronLeft(22)}</div>}
        right={<div style={{ color: E.forest }}>{I.gear(22)}</div>}
      />
      <Content pad={22}>
        <div style={{ marginTop: 8, marginBottom: 22 }}>
          <div style={{ fontFamily: F.display, fontSize: 18, fontStyle: 'italic', color: E.ink2, marginBottom: 2 }}>The</div>
          <div style={{ fontFamily: F.display, fontSize: 44, lineHeight: 1, color: E.ink, letterSpacing: '-0.02em', marginBottom: 10 }}>rivers kitchen.</div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: E.ink3, letterSpacing: 1.3, textTransform: 'uppercase' }}>Just you for now</div>
        </div>

        <button style={{
          padding: '12px 18px', borderRadius: 99, border: 'none',
          background: E.forest, color: E.forestText,
          fontSize: 14, fontWeight: 600, letterSpacing: -0.1,
          display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28,
        }}>{I.userPlus(16)} Invite someone</button>

        <SectionLabel>Members</SectionLabel>
        <Card padding={16} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 99,
              background: E.wheat, color: dark ? '#1A1408' : '#5C4318',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: F.display, fontStyle: 'italic', fontSize: 24, letterSpacing: -0.5,
            }}>M.</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: E.ink, letterSpacing: -0.1 }}>alex.rivers</span>
                <span style={{ fontSize: 12, color: E.ink3 }}>(you)</span>
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 10.5, color: E.ink3, marginTop: 2, letterSpacing: 0.5 }}>alex@example.com</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <Chip tone="sage">Owner</Chip>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: E.ink3, letterSpacing: 0.6, textTransform: 'uppercase' }}>Joined May 13 · 2026</span>
              </div>
            </div>
          </div>
        </Card>

        <SectionLabel>Pending invitations</SectionLabel>
        <Card padding={14} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: E.ink, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>alex+1@example.com</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: E.ink3, marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Sent May 13 · expires May 20</div>
            </div>
            <button style={{
              padding: '7px 12px', borderRadius: 99,
              background: E.dangerSoft, color: E.danger, border: 'none',
              fontSize: 12.5, fontWeight: 600, letterSpacing: -0.05,
            }}>Cancel</button>
          </div>
        </Card>

        <div style={{ textAlign: 'center' }}>
          <button style={{
            padding: '10px 18px', borderRadius: 99,
            background: 'transparent', border: `1px solid ${E.danger}55`, color: E.danger,
            fontSize: 13.5, fontWeight: 600, letterSpacing: -0.05,
          }}>Leave kitchen</button>
          <div style={{ fontSize: 12, color: E.ink3, marginTop: 10, lineHeight: 1.5, maxWidth: 280, margin: '10px auto 0' }}>Your recipes stay credited to you. You'll land in a fresh personal kitchen.</div>
        </div>
      </Content>
      <TabBar active="home" />
    </Phone>
  );
}

// ═══ 12. RECIPE DETAIL ════════════════════════════════════════
function ScreenRecipeDetail({ dark = false } = {}) {
  const E = dark ? E_DARK : E_LIGHT;
  const name = 'Chowmein Noodles';

  const ingredients = [
    'Chicken', 'Salt', 'Red pepper', 'Black pepper',
    'Garlic powder', 'Onion powder', 'Paprika powder', 'Cumin powder',
    'Ketchup', 'Sriracha', 'Chilli garlic sauce', 'Soy sauce', 'Vinegar',
    'Carrot', 'Bell pepper', 'Cabbage', 'Onions', 'Tomatoes',
  ];
  const checked = new Set([]); // none checked → "18 of 18 still need"

  const steps = [
    {
      n: 1,
      title: 'Marinate the chicken',
      items: ['Chicken', 'Salt', 'Red pepper', 'Black pepper', 'Garlic powder', 'Onion powder', 'Paprika powder', 'Cumin powder'],
    },
    {
      n: 2,
      title: 'Mix the sauce',
      items: ['Ketchup', 'Sriracha', 'Chilli garlic sauce', 'Soy sauce', 'Vinegar'],
    },
    {
      n: 3,
      title: 'Prep the vegetables',
      items: ['Carrot', 'Bell pepper', 'Cabbage', 'Onions'],
    },
  ];

  const stillNeed = ingredients.length - checked.size;

  return (
    <Phone dark={dark}>
      <NavBar
        title="Recipe"
        left={<div style={{ color: E.forest, display: 'flex', alignItems: 'center' }}>{I.chevronLeft(22)}</div>}
        right={<div style={{ color: E.forest }}>{I.edit(20)}</div>}
      />
      <Content pad={22}>
        {/* Hero tile */}
        <div style={{ height: 230, marginTop: 6, marginBottom: 20, borderRadius: 14, overflow: 'hidden' }}>
          <MealTile name={name} size="xl" radius={14} />
        </div>

        {/* Title block */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily: F.display, fontSize: 18, fontStyle: 'italic',
            color: E.ink2, marginBottom: 2, letterSpacing: 0.1,
          }}>Chowmein,</div>
          <div style={{
            fontFamily: F.display, fontSize: 46, lineHeight: 0.98,
            color: E.ink, letterSpacing: '-0.02em', marginBottom: 12,
          }}>Noodles.</div>
          <div style={{
            fontFamily: F.mono, fontSize: 11, color: E.ink3,
            letterSpacing: 1.3, textTransform: 'uppercase',
          }}>Added by alex.rivers · 1 cook · 4 days ago</div>
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
          <Chip icon={I.gauge(14)} tone="sage">Medium effort</Chip>
          <Chip tone="ghost">18 ingredients</Chip>
          <Chip tone="wheat">3 steps</Chip>
        </div>

        {/* Ingredients */}
        <SectionLabel action={
          <span style={{
            fontFamily: F.mono, fontSize: 10.5, color: E.ink3,
            letterSpacing: 1.2, textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>{stillNeed} of {ingredients.length} to buy</span>
        }>Ingredients</SectionLabel>

        <Card padding={0} style={{ marginBottom: 14, overflow: 'hidden' }}>
          {ingredients.map((ing, i) => {
            const on = checked.has(ing);
            return (
              <div key={ing} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px',
                borderTop: i === 0 ? 'none' : `1px solid ${E.borderSoft}`,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  border: `1.5px solid ${on ? E.forest : E.ink4}`,
                  background: on ? E.forest : 'transparent',
                  color: E.forestText,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </div>
                <div style={{
                  flex: 1, fontSize: 14.5, color: on ? E.ink3 : E.ink,
                  fontWeight: 500, letterSpacing: -0.1,
                  textDecoration: on ? 'line-through' : 'none',
                  textDecorationColor: E.ink4,
                }}>{ing}</div>
              </div>
            );
          })}
        </Card>

        {/* Shopping list actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 30 }}>
          <button style={{
            flex: 1, padding: '12px 14px', border: 'none', borderRadius: 99,
            background: dark ? E.sageBg : E.sageBg,
            color: dark ? E.forestSoft : E.forest,
            fontFamily: F.body, fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 8l5-5 5 5" />
              <path d="M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5" />
            </svg>
            Share shopping list
          </button>
          <button style={{
            padding: '12px 18px', border: `1px solid ${E.border}`, borderRadius: 99,
            background: 'transparent', color: E.ink,
            fontFamily: F.body, fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
            </svg>
            Copy
          </button>
        </div>

        {/* Recipe steps */}
        <SectionLabel>Recipe</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
          {steps.map(step => (
            <Card key={step.n} padding={18}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
                <div style={{
                  fontFamily: F.display, fontStyle: 'italic',
                  fontSize: 32, lineHeight: 1, color: dark ? E.forestSoft : E.forest,
                  letterSpacing: '-0.02em', minWidth: 24,
                }}>{step.n}.</div>
                <div style={{
                  fontFamily: F.display, fontSize: 22, lineHeight: 1.05,
                  color: E.ink, letterSpacing: '-0.02em',
                }}>{step.title}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {step.items.map(it => (
                  <span key={it} style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '5px 10px', borderRadius: 99,
                    background: E.cream, border: `1px solid ${E.borderSoft}`,
                    fontSize: 12.5, fontWeight: 500, color: E.ink2,
                    letterSpacing: -0.05,
                  }}>{it}</span>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Footer log-a-cook CTA */}
        <button style={{
          width: '100%', padding: '16px', border: 'none', borderRadius: 99,
          background: E.forest, color: E.forestText,
          fontFamily: F.body, fontSize: 15.5, fontWeight: 600, letterSpacing: -0.1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset',
        }}>
          {I.cutlery(20)} Log a cook
        </button>
      </Content>
      <TabBar active="library" />
    </Phone>
  );
}

Object.assign(window, {
  ScreenHome, ScreenPlans, ScreenPlanDetail, ScreenEditPlan,
  ScreenAdd, ScreenLogMeal, ScreenCaptureAI, ScreenLibrary,
  ScreenSettings, ScreenKitchen, AddDishSheet, ScreenRecipeDetail,
});
