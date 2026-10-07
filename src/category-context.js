// Editorial context only: category membership and counts always come from live data.
const descriptors = {
  'Account Management': 'Client relationships, partnerships, customer success and account growth.',
  'Bookkeeping & Finance': 'Bookkeeping, financial records and support for business finances.',
  'Customer Support': 'Help customers, solve problems and build lasting customer relationships.',
  'Data Entry': 'Keep records accurate, organized and ready for the next step.',
  'Design & Creative': 'Bring ideas to life through visual design and creative work.',
  'E-commerce': 'Support online stores, product listings and everyday commerce operations.',
  'Executive Assistant': 'Support leaders with calendars, coordination and day-to-day priorities.',
  'Marketing': 'Connect brands with their audiences through campaigns and marketing support.',
  'Operations & Admin': 'Keep teams organized and everyday business operations moving.',
  'Other Remote': 'Explore a wider range of opportunities for your skills.',
  'Project Management': 'Coordinate people, priorities and progress across projects.',
  'Recruitment & HR': 'Support hiring, people operations and the employee experience.',
  'Sales': 'Build customer relationships and help businesses grow.',
  'Social Media': 'Create content, engage communities and support social channels.',
  'Virtual Assistant': 'Help teams with the coordination and support that make work flow.',
  'Writing & Content': 'Turn ideas into clear writing and engaging content.'
};
export const categoryDescriptor = name => descriptors[name] || 'Explore opportunities that put your skills to work.';
