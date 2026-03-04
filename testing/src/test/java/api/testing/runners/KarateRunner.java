package api.testing.runners;

import com.intuit.karate.Results;
import com.intuit.karate.Runner;
import org.testng.annotations.Test;
import static org.testng.Assert.*;

/**
 * Karate Test Runner – discovers and executes all .feature files
 * located under src/test/java/api/testing/karate/.
 *
 * Uses the Karate Runner.path() API with TestNG so it integrates
 * correctly with the testng.xml suite and Surefire.
 *
 * Run with:  mvn test -Dtest=KarateRunner
 */
public class KarateRunner {

    @Test
    public void testAll() {
        Results results = Runner.path("classpath:api/testing/karate")
                .tags("~@ignore")
                .outputCucumberJson(true)
                .parallel(1);
        assertEquals(results.getFailCount(), 0, results.getErrorMessages());
    }

    @Test(groups = "smoke")
    public void testSmoke() {
        Results results = Runner.path("classpath:api/testing/karate")
                .tags("@smoke")
                .parallel(1);
        assertEquals(results.getFailCount(), 0, results.getErrorMessages());
    }

    @Test(groups = "functional")
    public void testFunctional() {
        Results results = Runner.path("classpath:api/testing/karate")
                .tags("@functional")
                .parallel(1);
        assertEquals(results.getFailCount(), 0, results.getErrorMessages());
    }
}
