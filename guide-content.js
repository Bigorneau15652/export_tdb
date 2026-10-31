// The content of the courses (one per type of block): the order of the sections and the keys of the texts, which are
// written in French and in English in shared/i18n.js. The names of the menus are never written in a text: they are
// written between double square brackets (`[[boardItem]]`) and replaced by the real name of the menu, so that a
// course can only name menus that exist. This file has no access to the page or to Grist: it is pure logic, tested
// with Node.
(function (root) {
  // A pair [menu, explanation]: the name of a menu of the settings panel and the key of its explanation.
  const TOPICS = {
    text: {
      title: `guide_text_title`,
      intro: `guide_text_intro`,
      steps: [`guide_text_step1`, `guide_text_step2`, `guide_text_step3`, `guide_text_step4`, `guide_text_step5`],
      menus: [[`boardSource`, `tipBoardSource`], [`boardColumn`, `tipBoardColumn`], [`boardText`, `tipBoardText`], [`boardField`, `tipBoardField`], [`boardSize`, `tipBoardSize`], [`boardAlign`, `tipBoardAlign`], [`boardFill`, `tipBoardFill`]],
      extras: [
        { heading: `guide_text_md_title`, items: [`guide_text_md1`, `guide_text_md2`, `guide_text_md3`, `guide_text_md4`, `guide_text_md5`] },
        { heading: `guide_text_fields_title`, paragraphs: [`guide_text_fields1`, `guide_text_fields2`] }
      ],
      examples: [
        {
          title: `guide_text_ex1_title`, settings: [`guide_text_ex1_a`, `guide_text_ex1_b`, `guide_text_ex1_c`],
          sample: { kind: `text`, lines: [{ tag: `h1`, text: `@guideBuildingA` }, { tag: `p`, text: `@guideBuiltIn` }] }
        },
        {
          title: `guide_text_ex2_title`, settings: [`guide_text_ex2_a`, `guide_text_ex2_b`, `guide_text_ex2_c`],
          sample: { kind: `text`, lines: [{ tag: `p`, text: `@guideComment` }] }
        }
      ],
      notes: [`guide_text_note1`, `guide_text_note2`, `guide_text_note3`]
    },
    table: {
      title: `guide_table_title`,
      intro: `guide_table_intro`,
      steps: [`guide_table_step1`, `guide_table_step2`, `guide_table_step3`, `guide_table_step4`, `guide_table_step5`, `guide_table_step6`, `guide_table_step7`, `guide_table_step8`],
      menus: [
        [`boardKind`, `tipBoardKind`], [`boardTableLabel`, `tipBoardTable`], [`boardRows`, `tipBoardRows`], [`boardItem`, `tipBoardItem`], [`boardItem2`, `tipBoardItem2`], [`boardSubtotals`, `tipSubtotals`], [`boardLabelTemplate`, `tipBoardLabel`], [`boardMerge`, `tipMerge`],
        [`boardColItem`, `tipBoardColItem`], [`boardSlice`, `tipBoardSlice`], [`boardColumns`, `tipBoardColumns`], [`boardTotalBelow`, `tipBoardTotal`], [`boardTotalLabel`, `tipBoardTotalLabel`],
        [`boardTotalRight`, `tipBoardTotalRight`], [`labFilters`, `tipFilter`], [`labSort`, `tipSort`]
      ],
      extras: [],
      examples: [
        {
          title: `guide_table_ex1_title`, settings: [`guide_table_ex1_a`, `guide_table_ex1_b`, `guide_table_ex1_c`],
          sample: { kind: `table`, headers: [`@guideWordNumber`, `@guideWordFloor`, `@guideWordArea`], rows: [[`A-001`, `@guideGround`, `20,5`], [`A-002`, `@guideFloor1`, `35`], [`A-003`, `@guideFloor1`, `12`]] }
        },
        {
          title: `guide_table_ex2_title`, settings: [`guide_table_ex2_a`, `guide_table_ex2_b`, `guide_table_ex2_c`],
          sample: { kind: `table`, headers: [`@guideWordFloor`, `@guideWordArea`], rows: [[`@guideGround`, `120,5`], [`@guideFloor1`, `47`]], total: [`@guideWordTotal`, `167,5`] }
        },
        {
          title: `guide_table_ex3_title`, settings: [`guide_table_ex3_a`, `guide_table_ex3_b`, `guide_table_ex3_c`],
          sample: { kind: `table`, headers: [`@guideWordFloor`, `@guideOffice`, `@guideClassroom`], rows: [[`@guideGround`, `80`, `40,5`], [`@guideFloor1`, `12`, `35`]] }
        },
        {
          title: `guide_table_ex4_title`, settings: [`guide_table_ex4_a`, `guide_table_ex4_b`],
          sample: { kind: `table`, headers: [``, `@guideWordArea`], rows: [[`@guideRoomOffice`, `20,5`], [`@guideRoomClass`, `35`]] }
        },
        {
          title: `guide_table_ex5_title`, settings: [`guide_table_ex5_a`, `guide_table_ex5_b`],
          sample: { kind: `table`, headers: [``, `@guideWordArea`], rows: [[`@guideSiteNorth`, `167,5`], [`@guideBuildingA`, `120,5`], [`@guideBuildingB`, `47`]] }
        }
      ],
      notes: [`guide_table_note1`, `guide_table_note2`, `guide_table_note3`, `guide_table_note4`, `guide_table_note5`]
    },
    record: {
      title: `guide_record_title`,
      intro: `guide_record_intro`,
      steps: [`guide_record_step1`, `guide_record_step2`, `guide_record_step3`, `guide_record_step4`],
      menus: [[`boardRecordItems`, `tipRecordItems`], [`boardSize`, `tipBoardSize`]],
      extras: [],
      examples: [
        {
          title: `guide_record_ex1_title`, settings: [`guide_record_ex1_a`, `guide_record_ex1_b`],
          sample: { kind: `record`, columns: 4, cells: [[`@guideWordName`, `@guideBuildingA`], [`@guideWordYear`, `1965`], [`@guideWordAddress`, `@guideAddress`], [`@guideWordArea`, `167,5`]] }
        }
      ],
      notes: [`guide_record_note1`, `guide_record_note2`]
    },
    chart: {
      title: `guide_chart_title`,
      intro: `guide_chart_intro`,
      steps: [`guide_chart_step1`, `guide_chart_step2`, `guide_chart_step3`, `guide_chart_step4`, `guide_chart_step5`, `guide_chart_step6`, `guide_chart_step7`],
      menus: [
        [`boardKind`, `tipBoardKind`], [`boardTableLabel`, `tipBoardTable`], [`boardRows`, `tipBoardRows`], [`boardItem`, `guide_chart_tip_item`], [`boardColItem`, `guide_chart_tip_colitem`],
        [`boardColumns`, `guide_chart_tip_columns`], [`boardChartType`, `tipChartType`], [`boardChartLegend`, `guide_chart_tip_legend`], [`boardChartLabels`, `tipChartLabels`],
        [`labFilters`, `tipFilter`], [`labSort`, `tipSort`]
      ],
      extras: [],
      examples: [
        {
          title: `guide_chart_ex1_title`, settings: [`guide_chart_ex1_a`, `guide_chart_ex1_b`, `guide_chart_ex1_c`],
          sample: { kind: `bars`, rows: [[`@guideGround`, `120,5`], [`@guideFloor1`, `47`]] }
        },
        {
          title: `guide_chart_ex2_title`, settings: [`guide_chart_ex2_a`, `guide_chart_ex2_b`, `guide_chart_ex2_c`],
          sample: { kind: `bars`, rows: [[`@guideOffice`, `92`], [`@guideClassroom`, `75,5`]] }
        }
      ],
      notes: [`guide_chart_note1`, `guide_chart_note2`, `guide_chart_note3`]
    },
    image: {
      title: `guide_image_title`,
      intro: `guide_image_intro`,
      steps: [`guide_image_step1`, `guide_image_step2`, `guide_image_step3`, `guide_image_step4`, `guide_image_step5`],
      menus: [[`boardImageColumn`, `tipImageColumn`], [`boardImageRank`, `tipImageRank`], [`boardImageCaption`, `tipImageCaption`]],
      extras: [],
      examples: [
        {
          title: `guide_image_ex1_title`, settings: [`guide_image_ex1_a`, `guide_image_ex1_b`],
          sample: { kind: `image`, lines: [{ tag: `p`, text: `@guideBuildingA` }] }
        },
        {
          title: `guide_image_ex2_title`, settings: [`guide_image_ex2_a`, `guide_image_ex2_b`],
          sample: { kind: `image`, lines: [] }
        }
      ],
      notes: [`guide_image_note1`, `guide_image_note2`]
    },
    indicator: {
      title: `guide_indicator_title`,
      intro: `guide_indicator_intro`,
      steps: [`guide_indicator_step1`, `guide_indicator_step2`, `guide_indicator_step3`, `guide_indicator_step4`, `guide_indicator_step5`, `guide_indicator_step6`],
      menus: [
        [`boardFieldTitle`, `tipFieldTitle`], [`boardIndicatorValue`, `guide_indicator_tip_value`], [`boardIndicatorNote`, `guide_indicator_tip_note`], [`boardSize`, `tipBoardSize`],
        [`boardIndicatorBase`, `guide_indicator_tip_base`], [`boardIndicatorRules`, `guide_indicator_tip_rules`]
      ],
      extras: [],
      examples: [
        {
          title: `guide_indicator_ex1_title`, settings: [`guide_indicator_ex1_a`, `guide_indicator_ex1_b`],
          sample: { kind: `indicator`, color: `none`, cells: [[`@guideTotalArea`, `167,5`, `@guideSquareMetres`]] }
        },
        {
          title: `guide_indicator_ex2_title`, settings: [`guide_indicator_ex2_a`, `guide_indicator_ex2_b`],
          sample: { kind: `indicator`, color: `green`, cells: [[`@guideWordOccupancy`, `85 %`, ``]] }
        }
      ],
      notes: [`guide_indicator_note1`, `guide_indicator_note2`]
    }
  };

  const TOKEN = /\[\[(\w+)\]\]/g;

  // The types of blocks that have a course.
  const TYPES = Object.keys(TOPICS);

  // A text with the names of the menus written in place: `[[boardItem]]` becomes « Item » (`t` gives a text from its key).
  function expand(text, t) {
    return String(text).replace(TOKEN, (_, key) => `« ${t(key)} »`);
  }

  // A value of a sample: a text that starts with `@` is the key of a translated text, any other text is shown as it is.
  function sampleText(value, t) {
    return typeof value === `string` && value.startsWith(`@`) ? t(value.slice(1)) : String(value);
  }

  // Every key of a text that the course of a type asks for, with the names of the menus it writes: { texts, menus }.
  function keysOf(type) {
    const topic = TOPICS[type];
    const texts = new Set([topic.title, topic.intro]);
    const menus = new Set();
    const scan = (key) => {
      texts.add(key);
    };
    topic.steps.forEach(scan);
    for (const [menu, tip] of topic.menus) {
      menus.add(menu);
      texts.add(tip);
    }
    for (const extra of topic.extras) {
      texts.add(extra.heading);
      (extra.items || []).forEach(scan);
      (extra.paragraphs || []).forEach(scan);
    }
    for (const example of topic.examples) {
      texts.add(example.title);
      example.settings.forEach(scan);
      const sample = example.sample;
      const values = [...(sample.headers || []), ...(sample.total || []), ...(sample.lines || []).map((line) => line.text), ...(sample.rows || []).flat(), ...(sample.cells || []).flat()];
      for (const value of values) if (typeof value === `string` && value.startsWith(`@`)) texts.add(value.slice(1));
    }
    topic.notes.forEach(scan);
    return { texts: [...texts], menus: [...menus] };
  }

  // The sections of the course of a type, ready to be drawn: [{ kind, ... }] with the texts already written in the
  // language of the widget (`t` gives a text from its key) and the names of the menus in place.
  function sectionsOf(type, t) {
    const topic = TOPICS[type];
    if (!topic) return [];
    const say = (key) => expand(t(key), t);
    const sections = [{ kind: `intro`, text: say(topic.intro) }];
    sections.push({ kind: `steps`, heading: t(`guide_steps`), items: topic.steps.map(say) });
    for (const extra of topic.extras) {
      sections.push({ kind: `block`, heading: t(extra.heading), items: (extra.items || []).map(say), paragraphs: (extra.paragraphs || []).map(say) });
    }
    sections.push({ kind: `menus`, heading: t(`guide_menus`), items: topic.menus.map(([menu, tip]) => ({ name: t(menu), text: expand(t(tip), t) })) });
    sections.push({
      kind: `examples`, heading: t(`guide_examples`),
      items: topic.examples.map((example) => ({
        title: t(example.title), settingsLabel: t(`guide_example_settings`), settings: example.settings.map(say), resultLabel: t(`guide_example_result`),
        sample: {
          kind: example.sample.kind,
          headers: (example.sample.headers || []).map((value) => sampleText(value, t)),
          rows: (example.sample.rows || []).map((row) => row.map((value) => sampleText(value, t))),
          total: example.sample.total ? example.sample.total.map((value) => sampleText(value, t)) : null,
          lines: (example.sample.lines || []).map((line) => ({ tag: line.tag, text: sampleText(line.text, t) })),
          columns: example.sample.columns || 0,
          cells: (example.sample.cells || []).map((cell) => cell.map((value) => sampleText(value, t))),
          color: example.sample.color || ``
        }
      }))
    });
    sections.push({ kind: `notes`, heading: t(`guide_notes`), items: topic.notes.map(say) });
    return sections;
  }

  const api = { TOPICS, TYPES, expand, keysOf, sectionsOf };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.exportTdbGuideContent = api;
})(typeof window !== `undefined` ? window : globalThis);
