// ============================================================
// School-mode question bank (server only, so students can't read the answers).
// Each set is a list of { q, a, wrong? }. When `wrong` is missing, the 3 wrong
// choices are drawn from the other answers in the same set (Blooket style).
// ============================================================

export const SETS = {
  blooket: {
    name: 'Class Blooket set (23 questions)',
    items: [
      { q: "A market structure where there is only one buyer or employer in a market, giving the firm substantial power over local labor, wages, and working conditions.", a: "Monopsony", wrong: ["Copyright", "EIN", "Confidentiality Agreement (NDA)"] },
      { q: "A failure to fulfill a legal obligation or responsibility owed to others.", a: "Breach of Duty", wrong: ["LLC/LLP", "EIN", "Fraud"] },
      { q: "Taxes withheld directly from an employee's salary by an employer—including Social Security, Medicare, and income tax—and remitted to the government.", a: "Payroll Taxes", wrong: ["Income Tax", "FLSA", "Monetary Policy"] },
      { q: "A binding legal contract that requires parties to maintain the non-disclosure of private or sensitive business information.", a: "Confidentiality Agreement (NDA)", wrong: ["EIN", "Copyright", "Breach of Duty"] },
      { q: "Any person or company that holds stock in a corporation, giving them a share in company ownership.", a: "Shareholder", wrong: ["Partnership", "C Corporation", "Owner"] },
      { q: "The failure to use reasonable care, resulting in damage or injury to another.", a: "Negligence", wrong: ["Fraud", "EIN", "LLC/LLP"] },
      { q: "A hybrid company structure that combines the limited liability protections of a corporation with the tax advantages of a partnership or sole proprietorship.", a: "LLC/LLP", wrong: ["Shareholder", "Owner", "Partnership"] },
      { q: "A false representation made to secure an unfair or unlawful gain.", a: "Fraud", wrong: ["Tort", "EIN", "LLC/LLP"] },
      { q: "A special type of corporation designed to avoid double taxation by allowing profits to pass directly to personal income tax returns.", a: "S Corporation", wrong: ["Owner", "Partnership", "Shareholder"] },
      { q: "A civilly wrongful act, either intentional or unintentional, that causes injury to another business or person and creates legal liability.", a: "Tort", wrong: ["Partnership", "LLC/LLP", "EIN"] },
      { q: "The government agency responsible for publishing and enforcing safety standards in the workplace.", a: "OSHA", wrong: ["Monopsony", "EIN", "Confidentiality Agreement (NDA)"] },
      { q: "A company or group of people recognized by law as a single, separate legal entity capable of making profits, paying taxes, and incurring legal liabilities separate from its owners.", a: "C Corporation", wrong: ["Partnership", "Shareholder", "Owner"] },
      { q: "The state of being held legally responsible for something, such as business debts or damages.", a: "Liability", wrong: ["Partnership", "Corporation", "Sole Proprietorship"] },
      { q: "A business partnership where general partners run the business and assume liability risk, while limited partners are not involved in management and are liable only up to the amount of their financial investment.", a: "Limited Partnership", wrong: ["Corporation", "Shareholder", "Sole Proprietorship"] },
      { q: "A tax levied by federal and state governments on the earnings or profits of individuals and businesses.", a: "Income Tax", wrong: ["Monetary Policy", "Monopsony", "FLSA"] },
      { q: "A business structure owned jointly by two or more people.", a: "Partnership", wrong: ["Shareholder", "Corporation", "Sole Proprietorship"] },
      { q: "Exclusive rights granted to creators over their literary, musical, and artistic works.", a: "Copyright", wrong: ["Breach of Duty", "Fraud", "EIN"] },
      { q: "The federal agency that enforces civil rights laws against workplace discrimination based on race, color, religion, sex, national origin, age, disability, or genetic information.", a: "EEOC", wrong: ["Monopsony", "Monetary Policy", "Confidentiality Agreement (NDA)"] },
      { q: "A business owned by only one person, representing the most common form of small business ownership.", a: "Sole Proprietorship", wrong: ["Liability", "Partnership", "Corporation"] },
      { q: "A federal tax ID number issued by the IRS to identify a business for tax reporting and employee management.", a: "EIN", wrong: ["Partnership", "LLC/LLP", "Shareholder"] },
      { q: "A federal labor law establishing minimum wage, overtime pay, recordkeeping, and youth employment standards.", a: "FLSA", wrong: ["Monopsony", "Monetary Policy", "Confidentiality Agreement (NDA)"] },
      { q: "Actions taken by a central bank (such as the Federal Reserve) to manage the money supply and interest rates to encourage economic growth.", a: "Monetary Policy", wrong: ["EIN", "Confidentiality Agreement (NDA)", "Monopsony"] },
      { q: "Creations or inventions used to build and distinguish a business.", a: "Intellectual Property (IP)", wrong: ["Fraud", "EIN", "Breach of Duty"] },
    ],
  },
  u9: {
    name: 'Unit 9 Test Review',
    items: [
      { q: 'the rights that creators have over their literary and artistic works', a: 'Copyright' },
      { q: 'protected rights for confidential information that may be sold or licensed', a: 'trade secrets' },
      { q: 'the action of damaging the good reputation of someone', a: 'defamation' },
      { q: 'a failure to do something that you are legally responsible for', a: 'breach of duty' },
      { q: 'a civilly wrongful act, either intentional or unintentional, that causes injury to another business or person and creates a legal liability for the business or person responsible for the act', a: 'Tort' },
      { q: 'the state of being held legally responsible for something', a: 'liability' },
      { q: 'a legal agreement that binds someone to nondisclosure of confidential information', a: 'confidentiality agreement' },
      { q: 'any person or company that shares in ownership by holding a share of company stock', a: 'shareholders' },
      { q: 'a hybrid company structure that combines the characteristics of a corporation with a partnership or sole proprietorship', a: 'limited liability company (LLC) or limited liability partnership (LLP)' },
      { q: 'the symbol to identify a company or brand', a: 'Logo' },
      { q: 'formal documents that establish the corporation', a: 'articles of incorporation' },
      { q: 'a sign capable of distinguishing goods and services of a business from those of other businesses', a: 'trademark' },
      { q: 'a false representation made to secure unfair or unlawful gain', a: 'fraud' },
      { q: 'failure to use reasonable care, resulting in damage or injury to another', a: 'Negligence' },
    ],
  },
  u10: {
    name: 'Unit 10: Government & Business',
    items: [
      // --- vocabulary (definition -> term)
      { q: 'products that people can consume without reducing their availability to others and which are accessible to all', a: 'public goods' },
      { q: 'a market where only one company provides a product or service', a: 'monopoly' },
      { q: 'a market structure where there is only one buyer, such as the only company in town that hires workers', a: 'monopsony' },
      { q: 'strategies that change government spending or taxes to influence economic conditions', a: 'fiscal policy' },
      { q: 'actions to control the money supply in order to promote economic growth', a: 'monetary policy' },
      { q: 'the central bank of the United States and the bank of the federal government', a: 'Federal Reserve' },
      { q: 'a tax system that imposes a lower tax rate on low-income earners compared to those with a higher income', a: 'progressive tax' },
      { q: 'a set of policies that support members of groups that have previously suffered discrimination', a: 'affirmative action' },
      { q: 'funding a business by raising small amounts of money online from large quantities of people', a: 'crowdfunding' },
      { q: 'the tax levied by the government on earnings', a: 'income tax' },
      { q: 'taxes withheld from an employee’s salary by an employer who then remits it to the government on their behalf', a: 'payroll taxes' },
      { q: 'a percentage of consumer transactions collected at the point of purchase', a: 'sales tax' },
      { q: 'a duty levied on goods at the time of manufacture, often on fuel, tobacco, and alcohol', a: 'excise tax' },
      { q: 'the tax paid on real estate or other forms of owned property', a: 'property tax' },
      // --- agencies & laws
      { q: 'the government agency that oversees safety and health in the workplace', a: 'OSHA', wrong: ['EEOC', 'FTC', 'SEC'] },
      { q: 'the government agency that enforces civil rights laws against workplace discrimination', a: 'EEOC', wrong: ['OSHA', 'FDA', 'IRS'] },
      { q: 'a civil rights law that prohibits discrimination against individuals with disabilities', a: 'Americans with Disabilities Act (ADA)', wrong: ['Family and Medical Leave Act (FMLA)', 'Fair Labor Standards Act (FLSA)', 'Economic Stimulus Act'] },
      { q: 'a labor law requiring employers to provide protected and unpaid leave for medical and family reasons', a: 'Family and Medical Leave Act (FMLA)', wrong: ['Fair Labor Standards Act (FLSA)', 'Americans with Disabilities Act (ADA)', 'Economic Stimulus Act'] },
      { q: 'a labor law that sets minimum wages, overtime pay, recordkeeping, and youth employment standards', a: 'Fair Labor Standards Act (FLSA)', wrong: ['Family and Medical Leave Act (FMLA)', 'Americans with Disabilities Act (ADA)', 'Affirmative action'] },
      { q: 'the agency that protects the public from products that could pose safety hazards like fire or electrical malfunction', a: 'Consumer Product Safety Commission (CPSC)', wrong: ['Food and Drug Administration (FDA)', 'Federal Trade Commission (FTC)', 'Environmental Protection Agency (EPA)'] },
      { q: 'the agency that approves new drugs and vaccines and regulates food nutrition labels', a: 'Food and Drug Administration (FDA)', wrong: ['Consumer Product Safety Commission (CPSC)', 'Environmental Protection Agency (EPA)', 'Securities and Exchange Commission (SEC)'] },
      { q: 'the agency that regulates waste disposal, greenhouse emissions, and pollutants', a: 'Environmental Protection Agency (EPA)', wrong: ['Food and Drug Administration (FDA)', 'Federal Trade Commission (FTC)', 'Occupational Safety and Health Administration (OSHA)'] },
      { q: 'the agency that stops unfair, deceptive, or fraudulent business practices like price fixing', a: 'Federal Trade Commission (FTC)', wrong: ['Securities and Exchange Commission (SEC)', 'Consumer Product Safety Commission (CPSC)', 'Internal Revenue Service (IRS)'] },
      { q: 'the agency that protects investors and oversees stock markets and how businesses raise capital', a: 'Securities and Exchange Commission (SEC)', wrong: ['Federal Trade Commission (FTC)', 'Federal Reserve', 'Internal Revenue Service (IRS)'] },
      { q: 'the government agency responsible for collecting taxes and enforcing tax laws', a: 'Internal Revenue Service (IRS)', wrong: ['Securities and Exchange Commission (SEC)', 'Federal Reserve', 'Small Business Administration (SBA)'] },
      // --- business structures & taxes
      { q: 'the business structure where profits are reported on the one owner’s personal tax return and taxed only once', a: 'sole proprietorship', wrong: ['C corporation', 'S corporation', 'partnership'] },
      { q: 'the business structure that pays tax on its profits AND its shareholders are taxed again (double taxation)', a: 'C corporation', wrong: ['S corporation', 'sole proprietorship', 'limited liability company (LLC)'] },
      { q: 'gives owners the liability protection of a corporation, but passes income through so there is only one level of tax', a: 'S corporation', wrong: ['C corporation', 'sole proprietorship', 'monopoly'] },
      { q: 'a business owned by several people where the business itself does not pay tax but passes profits to the owners', a: 'partnership', wrong: ['C corporation', 'sole proprietorship', 'monopsony'] },
      // --- understanding questions
      { q: 'FMLA applies to businesses with how many employees or more?', a: '50', wrong: ['10', '25', '100'] },
      { q: 'Under FMLA, eligible employees can take up to how much unpaid leave each year?', a: '12 weeks', wrong: ['2 weeks', '6 weeks', '6 months'] },
      { q: 'If both state and federal minimum wage laws apply to your business, which do you pay?', a: 'The higher of the two', wrong: ['The lower of the two', 'Always the federal one', 'Always the state one'] },
      { q: 'A business earns $100,000 and has $20,000 in deductions. How much income is taxed?', a: '$80,000', wrong: ['$100,000', '$120,000', '$20,000'] },
      { q: 'Which of these is a goal of an effective tax system?', a: 'Fairness — everyone pays a fair share', wrong: ['Taxing only small businesses', 'Making paperwork complicated', 'Keeping tax spending secret'] },
      { q: 'Which question is NOT allowed when interviewing a job applicant?', a: 'Are you married?', wrong: ['Do you have a legal right to work in the U.S.?', 'Are you at least 16 years old?', 'Can you work weekends?'] },
      { q: 'Excise taxes on things like sugary soda or tobacco are often called…', a: '“sin” taxes', wrong: ['progressive taxes', 'payroll taxes', 'property taxes'] },
      { q: 'Three cupcake shops agree to all charge the same price. Which agency would stop this price fixing?', a: 'Federal Trade Commission (FTC)', wrong: ['Food and Drug Administration (FDA)', 'Securities and Exchange Commission (SEC)', 'Environmental Protection Agency (EPA)'] },
      { q: 'During the late-2000s recession the Federal Reserve cut interest rates to 0% to…', a: 'encourage people to spend more and save less', wrong: ['make people save more money', 'raise the price of houses', 'collect more taxes'] },
    ],
  },
};
SETS.both = { name: 'Units 9 + 10', items: SETS.u9.items.concat(SETS.u10.items) };

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Per-player deck: shuffled order, refilled when used up (never the same question twice in a row).
export function nextQuestion(state, setKey) {
  const set = SETS[setKey] || SETS.blooket;
  if (!state.deck || state.set !== setKey || !state.deck.length) {
    state.set = setKey;
    const idx = shuffle(set.items.map((_, i) => i));
    if (state.last != null && idx.length > 1 && idx[idx.length - 1] === state.last) idx.unshift(idx.pop());
    state.deck = idx;
  }
  const i = state.deck.pop();
  state.last = i;
  const it = set.items[i];
  let wrong = it.wrong ? it.wrong.slice() : shuffle(set.items.filter((x) => x.a !== it.a && !x.wrong).map((x) => x.a)).slice(0, 3);
  if (wrong.length < 3) wrong = wrong.concat(shuffle(set.items.filter((x) => x.a !== it.a).map((x) => x.a)).filter((x) => !wrong.includes(x))).slice(0, 3);
  const choices = shuffle([it.a, ...wrong.slice(0, 3)]);
  state.cur = { i, ans: choices.indexOf(it.a), at: Date.now() };
  return { q: it.q, choices, n: set.items.length };
}
