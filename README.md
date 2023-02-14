# axe-site-scanner
Instead of scanning sites using pa11y, what if we used axe-core directly?

Advantages
* Not stuck with whatever version of axe-core that pa11y is currently using (currently almost 2 years behind)
* More control over which tests are run
* Axe errors don't get mapped into pa11y's alert levels (warning, error, notice), and they're more descriptive of what is actually going on
* Maybe better performance by running it ourselves—We might be able to run all the tests and only open headless Chrome once instead of closing and reopening it multiple times
