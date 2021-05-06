import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: 'Create Dynamic Views',
    Svg: require('../../static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
      Automatically collect and index notes based on tags, folder, contents, and more.
      </>
    ),
  },
  {
    title: 'Ease the Burden of Organization',
    Svg: require('../../static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
      Make dynamically-updating dashboards for reviewing projects, tasks, todos.
      </>
    ),
  },
  {
    title: 'Full JavaScript API',
    Svg: require('../../static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
      Write arbitrarily complex queries using the JavaScript API, which can
      produce full HTML output.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
