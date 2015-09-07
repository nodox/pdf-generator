'use strict';

// Dependencies
var mongoose = require('mongoose'),
	swig  = require('swig'),
	Action = mongoose.model('Action'),
	pdf = require('html-pdf'),
	AWS = require('aws-sdk'),
	juice = require('juice');

// Configure AWS :: this needs to not be shown
AWS.config.update({accessKeyId: 'AKIAJDTBBR457R4ZG6AQ', secretAccessKey: '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'});


exports.getAllActions = function(req, res) {
		// Get all of the users self-documented actions

		var user = req.user;

		Action.find({'user': user._id })
			.sort('created').lean(true)
			.exec(function(err, result) {
				if (err) { 
					console.log(err); 
				}
				res.json(result);
			});
};



exports.getSummaryReport = function(req, res) {
	// Generates a pdf report of the users documented actions

	var user = req.user;
	var today = new Date().toLocaleDateString();
	var reportName = user._id.toString();
	var pdfOptions = {
		format: 'A4'
	};

	// declare appropriate headers during response for readable file
	res.setHeader('Content-Type', 'application/pdf');

	// this header controls displaying the PDF in browswer... 'attachment' would force a download
	res.setHeader('Content-Disposition', 'inline; filename=Jastr_Summary_Report.pdf');

	//query the database
	Action.find({'user': user._id })
		.sort('created').lean(true)
		.exec(function(err, result) {
			if (err) console.log(err);

			// connect to AWS-S3 bucket
			var s3obj = new AWS.S3({ 
				params: { 
					Bucket: 'jastr.testing', 
					Key: reportName + '.pdf' 
				}
			});

			// convert the date object to string for each actions
			result.forEach(function(action) {
				action.created = action.created.toISOString().slice(0, 10);
			});

			var actionsDateRange =  result[0].created + ' thru ' + result[result.length - 1].created;

			// render new html from modified data
			var renderedTemplate = swig.renderFile(__dirname + '../../../views/templates/pdf/users-summary-report.server.view.html', {
					data: result,
					firstName: user.firstName,
					lastName: user.lastName,
					date: today,
					dateRange: actionsDateRange
			});

			var inlineStylesTemplate = juice(renderedTemplate);

			// convert template to pdf and upload to AWS once uploded server to client
			pdf.create(inlineStylesTemplate, pdfOptions).toStream(function (err, stream) {
				if (err) return console.log(err);

				var body = stream;
				s3obj.upload({ Body: body }, function(err, data) {
					if (err) console.log(err);
										
					// get file and send to client
					var params = {Bucket: 'jastr.testing', Key: reportName + '.pdf' };
					s3obj.getObject(params).createReadStream().pipe(res);

				});
			});
		});

};